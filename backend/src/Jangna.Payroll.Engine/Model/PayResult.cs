namespace Jangna.Payroll.Engine.Model;

public enum LineKind
{
    Earning,
    Deduction,
}

public static class LineCodes
{
    public const string Salary = "SALARY";
    public const string UnpaidAbsence = "UNPAID_ABSENCE";
    public const string DailyWage = "DAILY_WAGE";
    public const string HourlyWage = "HOURLY_WAGE";
    public const string Piece = "PIECE";
    public const string PieceOvertime = "PIECE_OT";
    public const string PieceHoliday = "PIECE_HOLIDAY";
    public const string PieceHolidayOvertime = "PIECE_HOLIDAY_OT";
    public const string Overtime = "OT";
    public const string HolidayWork = "HOLIDAY_WORK";
    public const string HolidayOvertime = "HOLIDAY_OT";
    public const string PublicHolidayPay = "PUBLIC_HOLIDAY";
    public const string PaidLeave = "PAID_LEAVE";
    public const string MinimumWageTopUp = "MIN_WAGE_TOPUP";
    public const string SocialSecurity = "SSO";
    public const string WithholdingTax = "WHT";
    public const string Advance = "ADVANCE";
}

public sealed record PayLine(
    string Code,
    string Description,
    LineKind Kind,
    decimal Quantity,
    decimal Rate,
    decimal Amount,
    bool Taxable = true,
    bool CountsForSocialSecurity = true);

public sealed record PayResult(
    IReadOnlyList<PayLine> Lines,
    decimal Gross,
    decimal TaxableIncome,
    decimal SocialSecurityEmployee,
    decimal SocialSecurityEmployer,
    decimal SocialSecurityWage,
    decimal WithholdingTax,
    decimal AdvanceDeducted,
    decimal AdvanceCarriedOver,
    decimal Net,
    IReadOnlyList<string> Warnings);
