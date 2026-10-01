using Jangna.Payroll.Engine.Rules;

namespace Jangna.Core.Entities;

/// <summary>ข้อมูลกลางของระบบ (ไม่ผูก tenant)</summary>
public sealed class LegalRuleSet : Entity
{
    public DateOnly EffectiveFrom { get; set; }
    public required LegalRules Payload { get; set; }
    public string? Source { get; set; }
}

/// <summary>ข้อมูลกลางของระบบ (ไม่ผูก tenant)</summary>
public sealed class MinimumWage : Entity
{
    public required string ProvinceCode { get; set; }
    public string? AreaCode { get; set; }
    public decimal DailyRate { get; set; }
    public DateOnly EffectiveFrom { get; set; }

    /// <summary>false = ยังไม่ได้ตรวจกับประกาศคณะกรรมการค่าจ้างฉบับจริง</summary>
    public bool Verified { get; set; }

    public string? Source { get; set; }

    public MinimumWageRate ToRate() => new(ProvinceCode, AreaCode, DailyRate, EffectiveFrom, Verified);
}
