namespace Jangna.Payroll.Engine.Model;

public enum PayBasis
{
    Monthly,
    Daily,
    Hourly,
    Piece,
}

public enum DayKind
{
    Workday,
    WeeklyHoliday,
    PublicHoliday,
}

public enum LeaveKind
{
    None,
    Paid,
    Unpaid,
}

/// <summary>
/// สรุปการทำงาน 1 วัน (มาจาก attendance ที่ผู้จัดการตรวจแล้ว)
/// วันทำงานที่ NormalHours = 0 และไม่มีลา = ขาดงาน
/// </summary>
public sealed record DayRecord(
    DateOnly Date,
    DayKind Kind,
    decimal NormalHours = 0,
    decimal OvertimeHours = 0,
    LeaveKind Leave = LeaveKind.None);

/// <summary>ผลงานต่อชิ้น (เช่น กล่องที่แพ็ค) — Overtime = ทำนอกเวลาทำงานปกติ</summary>
public sealed record PieceEntry(DateOnly Date, string Description, decimal Quantity, decimal Rate, bool Overtime = false);

/// <summary>รายได้อื่น เช่น เบี้ยขยัน ค่าอาหาร</summary>
public sealed record OtherEarning(string Code, string Description, decimal Amount, bool Taxable = true, bool CountsForSocialSecurity = true);

public sealed record EmployeePayProfile(
    PayBasis Basis,
    decimal BaseRate,
    bool IsFreelance = false,
    decimal AdditionalTaxAllowances = 0);

public sealed record PayPeriod(DateOnly Start, DateOnly End)
{
    public int Days => End.DayNumber - Start.DayNumber + 1;

    public bool IsFullCalendarMonth =>
        Start.Day == 1 && End == new DateOnly(Start.Year, Start.Month, DateTime.DaysInMonth(Start.Year, Start.Month));
}

/// <summary>ยอดสะสมของปีภาษีก่อนรอบนี้ — ใช้ประมาณภาษีทั้งปี</summary>
public sealed record YearToDate(decimal TaxableIncome = 0, decimal TaxWithheld = 0, decimal SocialSecurity = 0);

/// <summary>ยอดสะสมของเดือนเดียวกันก่อนรอบนี้ (กรณีจ่ายหลายรอบต่อเดือน) — สปส. คิดจากค่าจ้างทั้งเดือน</summary>
public sealed record MonthToDate(decimal SocialSecurityWage = 0, decimal SocialSecurityContribution = 0);

public sealed record PayInput
{
    public required EmployeePayProfile Employee { get; init; }
    public required PayPeriod Period { get; init; }
    public IReadOnlyList<DayRecord> Days { get; init; } = [];
    public IReadOnlyList<PieceEntry> PieceWork { get; init; } = [];
    public IReadOnlyList<OtherEarning> OtherEarnings { get; init; } = [];

    /// <summary>เงินเบิกล่วงหน้าที่ยังไม่ได้หัก (รวมยอดยกมาจากรอบก่อน)</summary>
    public decimal OutstandingAdvances { get; init; }

    /// <summary>ค่าแรงขั้นต่ำรายวันของสาขา — null = ไม่มีข้อมูล (จะมี warning)</summary>
    public decimal? MinimumDailyWage { get; init; }

    public bool MinimumWageVerified { get; init; }

    public YearToDate YearToDate { get; init; } = new();
    public MonthToDate MonthToDate { get; init; } = new();

    /// <summary>จำนวนรอบจ่ายที่เหลือในปีภาษี รวมรอบนี้ (เช่น จ่ายรายเดือน รอบเดือน ต.ค. = 3)</summary>
    public int RemainingPeriodsInYear { get; init; } = 1;
}
