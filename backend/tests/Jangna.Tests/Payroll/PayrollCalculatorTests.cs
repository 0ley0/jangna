using Jangna.Infrastructure.Seed;
using Jangna.Payroll.Engine.Calculators;
using Jangna.Payroll.Engine.Model;
using Jangna.Payroll.Engine.Rules;

namespace Jangna.Tests.Payroll;

public class PayrollCalculatorTests
{
    private static readonly LegalRules Rules2026 =
        LegalDataSeeder.RuleSets().Single(r => r.EffectiveFrom == new DateOnly(2026, 1, 1)).Payload;

    private static readonly PayPeriod October = new(new(2026, 10, 1), new(2026, 10, 31));

    private static DateOnly Oct(int day) => new(2026, 10, day);

    private static PayInput Input(PayBasis basis, decimal rate, params DayRecord[] days) => new()
    {
        Employee = new EmployeePayProfile(basis, rate),
        Period = October,
        Days = days,
        MinimumDailyWage = 400m,
        MinimumWageVerified = true,
        RemainingPeriodsInYear = 12,
    };

    private static DayRecord Work(int day, decimal hours = 8, decimal ot = 0) => new(Oct(day), DayKind.Workday, hours, ot);

    private static decimal Sum(PayResult r, string code) => r.Lines.Where(l => l.Code == code).Sum(l => l.Amount);

    // ---------- รายเดือน ----------

    [Fact]
    public void Monthly_15000_full_month()
    {
        var r = PayrollCalculator.Calculate(Input(PayBasis.Monthly, 15_000m), Rules2026);

        Assert.Equal(15_000m, r.Gross);
        Assert.Equal(750m, r.SocialSecurityEmployee);
        Assert.Equal(750m, r.SocialSecurityEmployer);
        Assert.Equal(0m, r.WithholdingTax); // 180k/ปี หักแล้วเงินได้สุทธิ 21,000 → ไม่เสียภาษี
        Assert.Equal(14_250m, r.Net);
        Assert.Empty(r.Warnings);
    }

    [Fact]
    public void Monthly_50000_withholds_projected_annual_tax()
    {
        // 600k − ค่าใช้จ่าย 100k − ส่วนตัว 60k − สปส. 10.5k = 429,500 → 7,500 + 12,950 = 20,450 / 12
        var r = PayrollCalculator.Calculate(Input(PayBasis.Monthly, 50_000m), Rules2026);

        Assert.Equal(875m, r.SocialSecurityEmployee);
        Assert.Equal(1_704.17m, r.WithholdingTax);
        Assert.Equal(47_420.83m, r.Net);
    }

    [Fact]
    public void Monthly_unpaid_absence_reduces_wage_and_sso_base()
    {
        var input = Input(PayBasis.Monthly, 15_000m,
            new DayRecord(Oct(5), DayKind.Workday),
            new DayRecord(Oct(6), DayKind.Workday, Leave: LeaveKind.Unpaid),
            new DayRecord(Oct(7), DayKind.Workday, Leave: LeaveKind.Paid),
            Work(8));

        var r = PayrollCalculator.Calculate(input, Rules2026);

        Assert.Equal(1_000m, Sum(r, LineCodes.UnpaidAbsence)); // 2 วัน × 500
        Assert.Equal(14_000m, r.Gross);
        Assert.Equal(700m, r.SocialSecurityEmployee);
    }

    [Fact]
    public void Monthly_overtime_and_holiday_work()
    {
        // ค่าจ้างต่อชั่วโมง = 15,000 / 30 / 8 = 62.50
        var input = Input(PayBasis.Monthly, 15_000m,
            Work(5, ot: 3),
            new DayRecord(Oct(4), DayKind.WeeklyHoliday, NormalHours: 8, OvertimeHours: 2));

        var r = PayrollCalculator.Calculate(input, Rules2026);

        Assert.Equal(281.25m, Sum(r, LineCodes.Overtime));      // 3 × 62.5 × 1.5
        Assert.Equal(500m, Sum(r, LineCodes.HolidayWork));      // 8 × 62.5 × 1 (เงินเดือนรวมวันหยุดแล้ว)
        Assert.Equal(375m, Sum(r, LineCodes.HolidayOvertime));  // 2 × 62.5 × 3
        Assert.Equal(16_156.25m, r.Gross);
    }

    [Fact]
    public void Monthly_partial_period_prorates_by_30_days()
    {
        var input = Input(PayBasis.Monthly, 15_000m) with { Period = new(Oct(16), Oct(31)) };

        var r = PayrollCalculator.Calculate(input, Rules2026);

        Assert.Equal(8_000m, r.Gross); // 16 วัน × 500
    }

    [Fact]
    public void Monthly_salary_below_minimum_wage_warns()
    {
        var r = PayrollCalculator.Calculate(Input(PayBasis.Monthly, 9_000m), Rules2026);

        Assert.Contains(r.Warnings, w => w.Th.Contains("ต่ำกว่าค่าแรงขั้นต่ำ"));
    }

    // ---------- รายวัน / รายชั่วโมง ----------

    [Fact]
    public void Daily_pays_worked_days_public_holiday_paid_leave_and_holiday_work()
    {
        var days = Enumerable.Range(1, 20).Select(d => Work(d)).ToList();
        days.Add(new DayRecord(Oct(23), DayKind.PublicHoliday));                    // ปิยมหาราช — ไม่ได้มาทำ
        days.Add(new DayRecord(Oct(21), DayKind.Workday, Leave: LeaveKind.Paid));   // ลาป่วย
        days.Add(new DayRecord(Oct(25), DayKind.WeeklyHoliday, 8, 2));              // มาทำวันหยุด

        var r = PayrollCalculator.Calculate(Input(PayBasis.Daily, 400m, [.. days]), Rules2026);

        Assert.Equal(8_000m, Sum(r, LineCodes.DailyWage));
        Assert.Equal(400m, Sum(r, LineCodes.PublicHolidayPay));
        Assert.Equal(400m, Sum(r, LineCodes.PaidLeave));
        Assert.Equal(800m, Sum(r, LineCodes.HolidayWork));      // 8 × 50 × 2
        Assert.Equal(300m, Sum(r, LineCodes.HolidayOvertime));  // 2 × 50 × 3
        Assert.Equal(9_900m, r.Gross);
        Assert.Equal(495m, r.SocialSecurityEmployee);
    }

    [Fact]
    public void Daily_half_day_is_prorated()
    {
        var r = PayrollCalculator.Calculate(Input(PayBasis.Daily, 400m, Work(1, hours: 4)), Rules2026);

        Assert.Equal(200m, r.Gross);
        Assert.Equal(0m, Sum(r, LineCodes.MinimumWageTopUp)); // ขั้นต่ำคิดตามสัดส่วนชั่วโมงด้วย
    }

    [Fact]
    public void Daily_rate_below_minimum_is_topped_up()
    {
        var r = PayrollCalculator.Calculate(Input(PayBasis.Daily, 350m, Work(1), Work(2)), Rules2026);

        Assert.Equal(100m, Sum(r, LineCodes.MinimumWageTopUp)); // 2 วัน × 50
        Assert.Equal(800m, r.Gross);
    }

    [Theory]
    [InlineData(60, 6, 360, 0)]   // 6 ชม. ขั้นต่ำ 300 → ไม่ต้องเติม
    [InlineData(45, 8, 360, 40)]  // 8 ชม. ขั้นต่ำ 400 → เติม 40
    public void Hourly_pays_hours_with_minimum_floor(decimal rate, decimal hours, decimal wage, decimal topUp)
    {
        var r = PayrollCalculator.Calculate(Input(PayBasis.Hourly, rate, Work(1, hours)), Rules2026);

        Assert.Equal(wage, Sum(r, LineCodes.HourlyWage));
        Assert.Equal(topUp, Sum(r, LineCodes.MinimumWageTopUp));
    }

    [Fact]
    public void Hourly_overtime_uses_hourly_rate()
    {
        var r = PayrollCalculator.Calculate(Input(PayBasis.Hourly, 60m, Work(1, 8, ot: 2)), Rules2026);

        Assert.Equal(180m, Sum(r, LineCodes.Overtime)); // 2 × 60 × 1.5
    }

    // ---------- ต่อชิ้น (คนแพ็ค) ----------

    [Fact]
    public void Piece_rate_with_multipliers_and_minimum_wage_top_up()
    {
        var input = Input(PayBasis.Piece, 0m,
            Work(1), Work(2), Work(3),
            new DayRecord(Oct(4), DayKind.WeeklyHoliday, NormalHours: 3)) with
        {
            PieceWork =
            [
                new(Oct(1), "แพ็คกล่อง", 100, 5m),
                new(Oct(2), "แพ็คกล่อง", 50, 5m),
                new(Oct(3), "แพ็คกล่อง", 90, 5m),
                new(Oct(3), "แพ็คกล่อง", 20, 5m, Overtime: true),
                new(Oct(4), "แพ็คกล่อง", 10, 5m),
            ],
        };

        var r = PayrollCalculator.Calculate(input, Rules2026);

        Assert.Equal(1_200m, Sum(r, LineCodes.Piece));          // 100+50+90 กล่อง × 5
        Assert.Equal(150m, Sum(r, LineCodes.PieceOvertime));    // 20 × 5 × 1.5
        Assert.Equal(100m, Sum(r, LineCodes.PieceHoliday));     // 10 × 5 × 2
        Assert.Equal(150m, Sum(r, LineCodes.MinimumWageTopUp)); // วันที่ 2 ได้ 250 → เติมเป็น 400
        Assert.Equal(1_600m, r.Gross);
    }

    [Fact]
    public void Piece_overtime_does_not_count_toward_minimum_wage()
    {
        var input = Input(PayBasis.Piece, 0m, Work(1)) with
        {
            PieceWork = [new(Oct(1), "แพ็ค", 10, 5m), new(Oct(1), "แพ็ค", 100, 5m, Overtime: true)],
        };

        var r = PayrollCalculator.Calculate(input, Rules2026);

        Assert.Equal(350m, Sum(r, LineCodes.MinimumWageTopUp)); // เวลาปกติได้ 50 → เติมเป็น 400
    }

    [Fact]
    public void Piece_public_holiday_falls_back_to_minimum_wage_with_warning()
    {
        var input = Input(PayBasis.Piece, 0m, new DayRecord(Oct(23), DayKind.PublicHoliday));

        var r = PayrollCalculator.Calculate(input, Rules2026);

        Assert.Equal(400m, Sum(r, LineCodes.PublicHolidayPay));
        Assert.Contains(r.Warnings, w => w.Th.Contains("ค่าจ้างรายวันพื้นฐาน"));
    }

    [Fact]
    public void Missing_minimum_wage_warns_once_and_skips_top_up()
    {
        var input = Input(PayBasis.Piece, 0m, Work(1), Work(2)) with
        {
            MinimumDailyWage = null,
            PieceWork = [new(Oct(1), "แพ็ค", 1, 5m)],
        };

        var r = PayrollCalculator.Calculate(input, Rules2026);

        Assert.Equal(0m, Sum(r, LineCodes.MinimumWageTopUp));
        Assert.Single(r.Warnings, w => w.Th.Contains("ไม่มีข้อมูลค่าแรงขั้นต่ำ"));
    }

    [Fact]
    public void Unverified_minimum_wage_warns_when_used()
    {
        var input = Input(PayBasis.Daily, 300m, Work(1)) with { MinimumWageVerified = false };

        var r = PayrollCalculator.Calculate(input, Rules2026);

        Assert.Contains(r.Warnings, w => w.Th.Contains("ยังไม่ได้ยืนยัน"));
    }

    // ---------- ฟรีแลนซ์ / เงินเบิก / สปส. หลายรอบ ----------

    [Fact]
    public void Freelance_withholds_3_percent_and_no_social_security()
    {
        var days = Enumerable.Range(1, 10).Select(d => Work(d)).ToArray();
        var input = Input(PayBasis.Daily, 500m, days) with { Employee = new EmployeePayProfile(PayBasis.Daily, 500m, IsFreelance: true) };

        var r = PayrollCalculator.Calculate(input, Rules2026);

        Assert.Equal(5_000m, r.Gross);
        Assert.Equal(0m, r.SocialSecurityEmployee);
        Assert.Equal(150m, r.WithholdingTax);
        Assert.Equal(4_850m, r.Net);
    }

    [Fact]
    public void Freelance_below_threshold_has_no_withholding()
    {
        var input = Input(PayBasis.Daily, 450m, Work(1), Work(2)) with { Employee = new EmployeePayProfile(PayBasis.Daily, 450m, IsFreelance: true) };

        var r = PayrollCalculator.Calculate(input, Rules2026);

        Assert.Equal(900m, r.Gross);
        Assert.Equal(0m, r.WithholdingTax);
    }

    [Fact]
    public void Advance_larger_than_pay_is_carried_over()
    {
        var input = Input(PayBasis.Daily, 400m, Work(1), Work(2)) with { OutstandingAdvances = 1_500m };

        var r = PayrollCalculator.Calculate(input, Rules2026);

        Assert.Equal(800m, r.Gross);
        Assert.Equal(83m, r.SocialSecurityEmployee); // ฐานขั้นต่ำ 1,650 × 5% = 82.50 → 83
        Assert.Equal(717m, r.AdvanceDeducted);
        Assert.Equal(783m, r.AdvanceCarriedOver);
        Assert.Equal(0m, r.Net);
        Assert.Contains(r.Warnings, w => w.Th.Contains("ยกไปหักรอบถัดไป"));
    }

    [Fact]
    public void Second_run_in_same_month_only_deducts_remaining_social_security()
    {
        var first = PayrollCalculator.Calculate(
            Input(PayBasis.Monthly, 20_000m) with { Period = new(Oct(1), Oct(15)) }, Rules2026);
        Assert.Equal(10_000m, first.Gross);
        Assert.Equal(500m, first.SocialSecurityEmployee);

        var second = PayrollCalculator.Calculate(
            Input(PayBasis.Monthly, 20_000m) with
            {
                Period = new(Oct(16), Oct(31)),
                MonthToDate = new(first.SocialSecurityWage, first.SocialSecurityEmployee),
            }, Rules2026);

        // ทั้งเดือน 20,667 → เพดาน 17,500 = 875 → รอบนี้หักอีก 375
        Assert.Equal(375m, second.SocialSecurityEmployee);
    }

    [Fact]
    public void Withholding_catches_up_when_year_to_date_was_under_withheld()
    {
        var input = Input(PayBasis.Monthly, 50_000m) with
        {
            RemainingPeriodsInYear = 3,
            YearToDate = new(TaxableIncome: 450_000m, TaxWithheld: 0m, SocialSecurity: 7_875m),
        };

        var r = PayrollCalculator.Calculate(input, Rules2026);

        // ทั้งปีเหมือนเดิม 20,450 แต่ยังไม่ได้หักเลย → หักที่เหลือใน 3 รอบ
        Assert.Equal(6_816.67m, r.WithholdingTax);
    }

    [Fact]
    public void Days_outside_period_are_ignored_with_warning()
    {
        var r = PayrollCalculator.Calculate(
            Input(PayBasis.Daily, 400m, Work(1), new DayRecord(new(2026, 11, 1), DayKind.Workday, 8)), Rules2026);

        Assert.Equal(400m, r.Gross);
        Assert.Contains(r.Warnings, w => w.Th.Contains("นอกรอบจ่าย"));
    }

    [Fact]
    public void Other_earnings_respect_tax_and_sso_flags()
    {
        var input = Input(PayBasis.Monthly, 15_000m) with
        {
            OtherEarnings = [new("DILIGENCE", "เบี้ยขยัน", 500m), new("PER_DIEM", "ค่าเบี้ยเลี้ยงเดินทาง", 1_000m, Taxable: false, CountsForSocialSecurity: false)],
        };

        var r = PayrollCalculator.Calculate(input, Rules2026);

        Assert.Equal(16_500m, r.Gross);
        Assert.Equal(15_500m, r.SocialSecurityWage);
        Assert.Equal(775m, r.SocialSecurityEmployee);
    }

    [Fact]
    public void Same_input_gives_same_result()
    {
        var input = Input(PayBasis.Daily, 400m, Work(1, ot: 2), Work(2));

        var a = PayrollCalculator.Calculate(input, Rules2026);
        var b = PayrollCalculator.Calculate(input, Rules2026);

        Assert.Equal(a.Net, b.Net);
        Assert.Equal(a.Lines, b.Lines);
    }

    [Fact]
    public void Rule_set_without_tax_throws()
    {
        var noTax = Rules2026 with { IncomeTax = null };

        Assert.Throws<InvalidOperationException>(() => PayrollCalculator.Calculate(Input(PayBasis.Monthly, 15_000m), noTax));
    }
}

public class IncomeTaxCalculatorTests
{
    private static readonly IncomeTaxRule Tax = LegalDataSeeder.RuleSets()[^1].Payload.IncomeTax!;

    [Theory]
    [InlineData(150_000, 0)]
    [InlineData(300_000, 7_500)]
    [InlineData(500_000, 27_500)]
    [InlineData(1_000_000, 115_000)]
    [InlineData(6_000_000, 1_615_000)]
    public void Progressive_brackets(decimal netIncome, decimal expected) =>
        Assert.Equal(expected, IncomeTaxCalculator.ProgressiveTax(netIncome, Tax.Brackets));

    [Fact]
    public void Expense_deduction_is_capped() =>
        // 1,000,000 − 100,000 − 60,000 = 840,000 → 115,000 − 20% × 160,000 = 83,000
        Assert.Equal(83_000m, IncomeTaxCalculator.AnnualTax(1_000_000m, 0m, Tax));
}
