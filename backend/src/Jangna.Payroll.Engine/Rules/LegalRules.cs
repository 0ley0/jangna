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
}

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
