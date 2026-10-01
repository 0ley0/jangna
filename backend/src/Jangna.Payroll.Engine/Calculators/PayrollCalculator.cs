using Jangna.Payroll.Engine.Model;
using Jangna.Payroll.Engine.Rules;

namespace Jangna.Payroll.Engine.Calculators;

/// <summary>
/// คำนวณเงินเดือน 1 คน 1 รอบ — pure function: input + กฎหมาย → รายการเงินได้/เงินหัก
/// ไม่แตะ DB ไม่อ่านเวลาปัจจุบัน เพื่อให้คำนวณซ้ำได้ผลเดิมเสมอ
/// </summary>
public static class PayrollCalculator
{
    /// <summary>ค่าจ้างรายวันของลูกจ้างรายเดือน = เงินเดือน / 30 (ตามแนวปฏิบัติกฎหมายแรงงาน)</summary>
    public const decimal DaysPerMonthForDailyRate = 30m;

    public static PayResult Calculate(PayInput input, LegalRules rules)
    {
        var ctx = new Context(input, rules);

        foreach (var day in input.Days.Where(d => d.Date < input.Period.Start || d.Date > input.Period.End))
            ctx.Warn($"วันที่ {day.Date:yyyy-MM-dd} อยู่นอกรอบจ่าย — ไม่นำมาคิด");

        var days = input.Days.Where(d => d.Date >= input.Period.Start && d.Date <= input.Period.End).ToList();
        CheckWorkingHours(ctx, days);

        switch (input.Employee.Basis)
        {
            case PayBasis.Monthly: Monthly(ctx, days); break;
            case PayBasis.Daily: TimeBased(ctx, days, dailyRate: input.Employee.BaseRate); break;
            case PayBasis.Hourly: TimeBased(ctx, days, dailyRate: input.Employee.BaseRate * ctx.HoursPerDay); break;
            case PayBasis.Piece: Piece(ctx, days); break;
            default: throw new ArgumentOutOfRangeException(nameof(input), input.Employee.Basis, null);
        }

        foreach (var other in input.OtherEarnings)
            ctx.Earn(other.Code, other.Description, 1, other.Amount, other.Taxable, other.CountsForSocialSecurity);

        return Finish(ctx);
    }

    // ---------- เงินได้ ----------

    private static void Monthly(Context ctx, List<DayRecord> days)
    {
        var salary = ctx.Input.Employee.BaseRate;
        var dailyRate = salary / DaysPerMonthForDailyRate;
        var hourlyRate = dailyRate / ctx.HoursPerDay;

        if (ctx.Input.Period.IsFullCalendarMonth)
        {
            ctx.Earn(LineCodes.Salary, "เงินเดือน", 1, salary);
        }
        else
        {
            var periodDays = ctx.Input.Period.Days;
            ctx.Earn(LineCodes.Salary, $"เงินเดือน ({periodDays} วัน)", periodDays, Math.Min(salary, dailyRate * periodDays), rate: dailyRate);
        }

        var unpaid = days.Count(d => d.Kind == DayKind.Workday && d.Leave != LeaveKind.Paid && d.NormalHours == 0);
        if (unpaid > 0)
            ctx.Deduct(LineCodes.UnpaidAbsence, "หักวันขาด/ลาไม่รับค่าจ้าง", unpaid, dailyRate, wageReduction: true);

        foreach (var day in days)
        {
            if (day.Kind == DayKind.Workday)
            {
                ctx.Overtime(day, hourlyRate);
            }
            else
            {
                // เงินเดือนครอบคลุมวันหยุดแล้ว → ทำงานวันหยุดได้เพิ่ม 1 เท่า
                ctx.HolidayWork(day, hourlyRate, ctx.Rules.Overtime.HolidayWorkMonthlyPaid);
                ctx.HolidayOvertime(day, hourlyRate);
            }
        }

        if (ctx.Input.MinimumDailyWage is { } minimum && dailyRate < minimum)
            ctx.Warn($"เงินเดือนเฉลี่ย {Money(dailyRate)} บาท/วัน ต่ำกว่าค่าแรงขั้นต่ำ {Money(minimum)} บาท/วัน");
    }

    /// <summary>รายวัน/รายชั่วโมง: จ่ายตามชั่วโมงที่ทำจริง + วันหยุดนักขัตฤกษ์/ลาที่ได้ค่าจ้าง</summary>
    private static void TimeBased(Context ctx, List<DayRecord> days, decimal dailyRate)
    {
        var hourlyRate = dailyRate / ctx.HoursPerDay;
        var isDaily = ctx.Input.Employee.Basis == PayBasis.Daily;
        var code = isDaily ? LineCodes.DailyWage : LineCodes.HourlyWage;

        var workedHours = 0m;
        foreach (var day in days)
        {
            switch (day.Kind)
            {
                case DayKind.Workday when day.NormalHours > 0:
                    var hours = Math.Min(day.NormalHours, ctx.HoursPerDay);
                    workedHours += hours;
                    ctx.TopUpToMinimumWage(day, hours * hourlyRate, hours);
                    ctx.Overtime(day, hourlyRate);
                    break;

                case DayKind.Workday when day.Leave == LeaveKind.Paid:
                    ctx.Earn(LineCodes.PaidLeave, $"ลาได้รับค่าจ้าง {day.Date:dd/MM}", 1, dailyRate);
                    break;

                case DayKind.PublicHoliday when day.NormalHours == 0:
                    // ลูกจ้างรายวัน/ชั่วโมงมีสิทธิ์ได้ค่าจ้างวันหยุดตามประเพณี
                    ctx.Earn(LineCodes.PublicHolidayPay, $"วันหยุดนักขัตฤกษ์ {day.Date:dd/MM}", 1, dailyRate);
                    break;

                case DayKind.PublicHoliday or DayKind.WeeklyHoliday:
                    ctx.HolidayWork(day, hourlyRate, ctx.Rules.Overtime.HolidayWorkNonMonthlyPaid);
                    ctx.HolidayOvertime(day, hourlyRate);
                    break;
            }
        }

        if (workedHours > 0)
        {
            if (isDaily)
                ctx.Earn(code, "ค่าจ้างรายวัน", workedHours / ctx.HoursPerDay, workedHours * hourlyRate, rate: dailyRate);
            else
                ctx.Earn(code, "ค่าจ้างรายชั่วโมง", workedHours, workedHours * hourlyRate, rate: hourlyRate);
        }
    }

    /// <summary>
    /// ต่อชิ้น: ค่าจ้างตามผลงาน × ตัวคูณ (OT 1.5, วันหยุด 2, OT วันหยุด 3)
    /// วันทำงานปกติถ้าผลงานต่ำกว่าค่าแรงขั้นต่ำ → เติมให้ถึง
    /// </summary>
    private static void Piece(Context ctx, List<DayRecord> days)
    {
        var dayKinds = days.ToDictionary(d => d.Date, d => d.Kind);
        var ot = ctx.Rules.Overtime;
        var normalByDate = new Dictionary<DateOnly, decimal>();

        foreach (var entry in ctx.Input.PieceWork)
        {
            if (entry.Date < ctx.Input.Period.Start || entry.Date > ctx.Input.Period.End)
            {
                ctx.Warn($"ผลงาน {entry.Description} วันที่ {entry.Date:yyyy-MM-dd} อยู่นอกรอบจ่าย — ไม่นำมาคิด");
                continue;
            }

            var kind = dayKinds.GetValueOrDefault(entry.Date, DayKind.Workday);
            var holiday = kind != DayKind.Workday;
            var (code, label, multiplier) = (holiday, entry.Overtime) switch
            {
                (false, false) => (LineCodes.Piece, "", 1m),
                (false, true) => (LineCodes.PieceOvertime, " (OT)", ot.WorkdayOvertime),
                (true, false) => (LineCodes.PieceHoliday, " (วันหยุด)", ot.HolidayWorkNonMonthlyPaid),
                (true, true) => (LineCodes.PieceHolidayOvertime, " (OT วันหยุด)", ot.HolidayOvertime),
            };

            var amount = entry.Quantity * entry.Rate * multiplier;
            ctx.Earn(code, $"{entry.Description}{label} {entry.Date:dd/MM}", entry.Quantity, amount, rate: entry.Rate * multiplier);
            if (code == LineCodes.Piece) normalByDate[entry.Date] = normalByDate.GetValueOrDefault(entry.Date) + amount;
        }

        foreach (var day in days)
        {
            if (day.Kind == DayKind.Workday && day.NormalHours > 0)
            {
                var hours = Math.Min(day.NormalHours, ctx.HoursPerDay);
                ctx.TopUpToMinimumWage(day, normalByDate.GetValueOrDefault(day.Date), hours);
            }
            else if (day.Kind == DayKind.PublicHoliday && day.NormalHours == 0 || day.Kind == DayKind.Workday && day.Leave == LeaveKind.Paid)
            {
                // วันหยุดตามประเพณี/ลาได้ค่าจ้าง: ใช้ค่าจ้างรายวันพื้นฐาน ถ้าไม่ได้ตั้งใช้ค่าแรงขั้นต่ำ
                var dailyRate = ctx.Input.Employee.BaseRate > 0 ? ctx.Input.Employee.BaseRate : ctx.Input.MinimumDailyWage;
                if (dailyRate is null)
                {
                    ctx.Warn($"วันที่ {day.Date:dd/MM} ควรได้ค่าจ้าง แต่ไม่มีค่าจ้างรายวันพื้นฐานหรือค่าแรงขั้นต่ำ");
                    continue;
                }
                var (code, label) = day.Kind == DayKind.PublicHoliday
                    ? (LineCodes.PublicHolidayPay, "วันหยุดนักขัตฤกษ์")
                    : (LineCodes.PaidLeave, "ลาได้รับค่าจ้าง");
                ctx.Earn(code, $"{label} {day.Date:dd/MM}", 1, dailyRate.Value);
            }
        }

        if (ctx.Input.Employee.BaseRate == 0 && days.Any(d => d.Kind == DayKind.PublicHoliday && d.NormalHours == 0))
            ctx.Warn("ค่าจ้างวันหยุดนักขัตฤกษ์ของลูกจ้างต่อชิ้นใช้ค่าแรงขั้นต่ำแทน — ควรตั้งค่าจ้างรายวันพื้นฐาน (ค่าเฉลี่ยผลงาน)");
    }

    private static void CheckWorkingHours(Context ctx, List<DayRecord> days)
    {
        foreach (var day in days.Where(d => d.NormalHours > ctx.HoursPerDay))
            ctx.Warn($"วันที่ {day.Date:dd/MM} เวลาปกติ {day.NormalHours} ชม. เกิน {ctx.HoursPerDay} ชม. — ส่วนที่เกินควรบันทึกเป็น OT");

        foreach (var day in days.Where(d => d.NormalHours < 0 || d.OvertimeHours < 0))
            throw new ArgumentException($"ชั่วโมงทำงานติดลบ: {day.Date:yyyy-MM-dd}");
    }

    // ---------- สรุป + เงินหัก ----------

    private static PayResult Finish(Context ctx)
    {
        var input = ctx.Input;
        var gross = ctx.Lines.Sum(l => l.Kind == LineKind.Earning ? l.Amount : -l.Amount);
        var ssoWage = ctx.Lines.Where(l => l.CountsForSocialSecurity).Sum(l => l.Kind == LineKind.Earning ? l.Amount : -l.Amount);
        var taxable = ctx.Lines.Where(l => l.Taxable).Sum(l => l.Kind == LineKind.Earning ? l.Amount : -l.Amount);

        var sso = 0m;
        var wht = 0m;

        if (input.Employee.IsFreelance)
        {
            // จ้างทำของ/บริการ: ไม่เข้า สปส. หัก ณ ที่จ่ายตามอัตรา ภ.ง.ด.3
            var tax = RequireTax(ctx.Rules);
            if (gross >= tax.FreelanceWithholdingThreshold)
                wht = Math.Round(gross * tax.FreelanceWithholdingRate, 2, MidpointRounding.AwayFromZero);
            ssoWage = 0;
        }
        else
        {
            // สปส. คิดจากค่าจ้างทั้งเดือน → หักส่วนที่รอบก่อนในเดือนเดียวกันหักไปแล้ว
            var monthWage = input.MonthToDate.SocialSecurityWage + ssoWage;
            var monthContribution = SocialSecurityCalculator.MonthlyContribution(monthWage, ctx.Rules.SocialSecurity);
            sso = Math.Max(0, monthContribution - input.MonthToDate.SocialSecurityContribution);

            wht = IncomeTaxCalculator.PeriodWithholding(
                taxable, sso,
                input.YearToDate.TaxableIncome, input.YearToDate.TaxWithheld, input.YearToDate.SocialSecurity,
                input.RemainingPeriodsInYear, input.Employee.AdditionalTaxAllowances, RequireTax(ctx.Rules));
        }

        if (sso > 0) ctx.Deduct(LineCodes.SocialSecurity, "ประกันสังคม", 1, sso);
        if (wht > 0) ctx.Deduct(LineCodes.WithholdingTax, input.Employee.IsFreelance ? "ภาษีหัก ณ ที่จ่าย (ภ.ง.ด.3)" : "ภาษีหัก ณ ที่จ่าย", 1, wht);

        var beforeAdvance = gross - sso - wht;
        var advance = Math.Clamp(input.OutstandingAdvances, 0, Math.Max(0, beforeAdvance));
        if (advance > 0) ctx.Deduct(LineCodes.Advance, "หักเงินเบิกล่วงหน้า", 1, advance);

        var carried = input.OutstandingAdvances - advance;
        if (carried > 0) ctx.Warn($"เงินเบิกล่วงหน้าเกินยอดจ่าย — ยกไปหักรอบถัดไป {Money(carried)} บาท");
        if (gross < 0) ctx.Warn("ยอดเงินได้ติดลบ — ตรวจวันขาดงาน/รายการหัก");

        return new PayResult(
            ctx.Lines, Round(gross), sso, sso, Round(Math.Max(0, ssoWage)), wht, advance, carried,
            Round(beforeAdvance - advance), ctx.Warnings);
    }

    private static IncomeTaxRule RequireTax(LegalRules rules) =>
        rules.IncomeTax ?? throw new InvalidOperationException("rule set ไม่มีข้อมูลภาษีเงินได้ — รัน seeder เพื่อ sync");

    private static decimal Round(decimal v) => Math.Round(v, 2, MidpointRounding.AwayFromZero);

    private static string Money(decimal v) => v.ToString("#,##0.00");

    private sealed class Context(PayInput input, LegalRules rules)
    {
        public PayInput Input { get; } = input;
        public LegalRules Rules { get; } = rules;
        public decimal HoursPerDay => Rules.WorkingTime.MaxHoursPerDay;
        public List<PayLine> Lines { get; } = [];
        public List<string> Warnings { get; } = [];
        private bool _warnedNoMinimum;

        public void Warn(string message) => Warnings.Add(message);

        public void Earn(string code, string description, decimal qty, decimal amount, bool taxable = true,
            bool sso = true, decimal? rate = null)
        {
            if (amount == 0) return;
            Lines.Add(new PayLine(code, description, LineKind.Earning, qty, Round(rate ?? amount / (qty == 0 ? 1 : qty)), Round(amount), taxable, sso));
        }

        /// <summary>wageReduction = หักจากค่าจ้าง (ลดฐานภาษี/สปส.) ไม่ใช่เงินหักหลังคำนวณ</summary>
        public void Deduct(string code, string description, decimal qty, decimal rate, bool wageReduction = false) =>
            Lines.Add(new PayLine(code, description, LineKind.Deduction, qty, Round(rate), Round(qty * rate), wageReduction, wageReduction));

        public void Overtime(DayRecord day, decimal hourlyRate)
        {
            if (day.OvertimeHours <= 0) return;
            var m = Rules.Overtime.WorkdayOvertime;
            Earn(LineCodes.Overtime, $"OT {m} เท่า {day.Date:dd/MM}", day.OvertimeHours, day.OvertimeHours * hourlyRate * m, rate: hourlyRate * m);
        }

        public void HolidayWork(DayRecord day, decimal hourlyRate, decimal multiplier)
        {
            if (day.NormalHours <= 0) return;
            var hours = Math.Min(day.NormalHours, HoursPerDay);
            Earn(LineCodes.HolidayWork, $"ทำงานวันหยุด {multiplier} เท่า {day.Date:dd/MM}", hours, hours * hourlyRate * multiplier, rate: hourlyRate * multiplier);
        }

        public void HolidayOvertime(DayRecord day, decimal hourlyRate)
        {
            if (day.OvertimeHours <= 0) return;
            var m = Rules.Overtime.HolidayOvertime;
            Earn(LineCodes.HolidayOvertime, $"OT วันหยุด {m} เท่า {day.Date:dd/MM}", day.OvertimeHours, day.OvertimeHours * hourlyRate * m, rate: hourlyRate * m);
        }

        /// <summary>เติมค่าจ้างเวลาปกติของวันนั้นให้ไม่ต่ำกว่าค่าแรงขั้นต่ำ (คิดตามสัดส่วนชั่วโมง)</summary>
        public void TopUpToMinimumWage(DayRecord day, decimal earnedNormal, decimal hours)
        {
            if (Input.MinimumDailyWage is not { } minimum)
            {
                if (!_warnedNoMinimum) Warn("ไม่มีข้อมูลค่าแรงขั้นต่ำของสาขา — ไม่ได้ตรวจขั้นต่ำ");
                _warnedNoMinimum = true;
                return;
            }

            var floor = minimum * hours / HoursPerDay;
            if (earnedNormal >= floor) return;

            Earn(LineCodes.MinimumWageTopUp, $"เติมให้ถึงค่าแรงขั้นต่ำ {day.Date:dd/MM}", 1, floor - earnedNormal);
            if (!Input.MinimumWageVerified && !_warnedUnverified)
            {
                Warn("ค่าแรงขั้นต่ำที่ใช้ยังไม่ได้ยืนยันกับประกาศฉบับจริง");
                _warnedUnverified = true;
            }
        }

        private bool _warnedUnverified;
    }
}
