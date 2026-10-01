namespace Jangna.Payroll.Engine.Rules;

/// <summary>
/// กฎหมายที่ใช้คำนวณเงินเดือน ณ ช่วงเวลาหนึ่ง (effective-dated).
/// เก็บเป็นข้อมูล ไม่ใช่โค้ด — เมื่อกฎหมายเปลี่ยนให้เพิ่ม rule set ใหม่ที่มี EffectiveFrom ใหม่
/// </summary>
public sealed record LegalRules
{
    public required SocialSecurityRule SocialSecurity { get; init; }
    public required WorkingTimeRule WorkingTime { get; init; }
    public required OvertimeRule Overtime { get; init; }

    /// <summary>nullable เพราะ rule set ที่บันทึกก่อนมีภาษีจะไม่มี field นี้ — seeder sync ให้ครบตอนเริ่มระบบ</summary>
    public IncomeTaxRule? IncomeTax { get; init; }
}

/// <summary>
/// ภาษีเงินได้บุคคลธรรมดา (ภ.ง.ด.1 — หัก ณ ที่จ่ายแบบประมาณทั้งปี) และอัตราหักฟรีแลนซ์ (ภ.ง.ด.3)
/// Brackets เรียงจากน้อยไปมาก, UpTo = null คือขั้นสุดท้าย
/// </summary>
public sealed record IncomeTaxRule(
    decimal ExpenseDeductionRate,
    decimal ExpenseDeductionCap,
    decimal PersonalAllowance,
    IReadOnlyList<TaxBracket> Brackets,
    decimal FreelanceWithholdingRate,
    decimal FreelanceWithholdingThreshold);

public sealed record TaxBracket(decimal? UpTo, decimal Rate);

/// <summary>ประกันสังคม มาตรา 33: อัตราเงินสมทบ และฐานค่าจ้างต่ำสุด/สูงสุด ต่อเดือน</summary>
public sealed record SocialSecurityRule(decimal Rate, decimal MinMonthlyBase, decimal MaxMonthlyBase);

/// <summary>เวลาทำงานปกติสูงสุด</summary>
public sealed record WorkingTimeRule(decimal MaxHoursPerDay, decimal MaxHoursPerWeek);

/// <summary>ตัวคูณค่าล่วงเวลา/ค่าทำงานในวันหยุด (ขั้นต่ำตามกฎหมาย)</summary>
public sealed record OvertimeRule(
    decimal WorkdayOvertime,
    decimal HolidayWorkMonthlyPaid,
    decimal HolidayWorkNonMonthlyPaid,
    decimal HolidayOvertime);

public sealed record EffectiveRuleSet(DateOnly EffectiveFrom, LegalRules Rules);
