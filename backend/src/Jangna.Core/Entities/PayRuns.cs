using Jangna.Payroll.Engine.Model;
using Jangna.Payroll.Engine.Rules;

namespace Jangna.Core.Entities;

public enum PayRunStatus
{
    Draft,
    Locked,
}

/// <summary>
/// รอบจ่ายเงิน: Draft (คำนวณซ้ำได้) → Locked (ห้ามแก้)
/// เก็บ snapshot ของกฎหมายและ input ทุกคน เพื่อตรวจสอบ/คำนวณซ้ำย้อนหลังได้ผลเดิม
/// </summary>
public sealed class PayRun : TenantEntity, IAudited
{
    public DateOnly PeriodStart { get; set; }
    public DateOnly PeriodEnd { get; set; }
    public PayRunStatus Status { get; set; }
    public DateOnly RuleSetEffectiveFrom { get; set; }
    public required LegalRules RulesSnapshot { get; set; }
    public DateTimeOffset CalculatedAt { get; set; }
    public DateTimeOffset? LockedAt { get; set; }
    public Guid? LockedBy { get; set; }
    public List<PayRunItem> Items { get; set; } = [];

    public bool Covers(DateOnly date) => PeriodStart <= date && date <= PeriodEnd;
}

public sealed class PayRunItem : TenantEntity
{
    public Guid PayRunId { get; set; }
    public Guid EmployeeId { get; set; }
    public required string EmployeeName { get; set; }
    public PayType PayType { get; set; }
    public bool IsFreelance { get; set; }

    public decimal Gross { get; set; }
    public decimal TaxableIncome { get; set; }
    public decimal SocialSecurityWage { get; set; }
    public decimal SocialSecurityEmployee { get; set; }
    public decimal SocialSecurityEmployer { get; set; }
    public decimal WithholdingTax { get; set; }
    public decimal AdvanceDeducted { get; set; }
    public decimal AdvanceCarriedOver { get; set; }
    public decimal Net { get; set; }

    public List<PayLine> Lines { get; set; } = [];
    public List<string> Warnings { get; set; } = [];
    public required PayInput Input { get; set; }
}
