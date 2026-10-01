using Jangna.Payroll.Engine.Model;

namespace Jangna.Core.Entities;

/// <summary>บันทึกการเปลี่ยนแปลงอัตโนมัติ (ดู JangnaDbContext)</summary>
public interface IAudited;

public enum WorkSource
{
    Manual,
    Attendance,
    PackStation,
}

/// <summary>สรุปการทำงาน 1 วันของพนักงาน 1 คน — input ของ payroll (กรอกเอง หรือสรุปจากการลงเวลา)</summary>
public sealed class WorkDay : TenantEntity, IAudited
{
    public Guid EmployeeId { get; set; }
    public Employee? Employee { get; set; }
    public DateOnly Date { get; set; }
    public DayKind Kind { get; set; }
    public decimal NormalHours { get; set; }
    public decimal OvertimeHours { get; set; }
    public LeaveKind Leave { get; set; }
    public WorkSource Source { get; set; }
    public string? Note { get; set; }

    public DayRecord ToDayRecord() => new(Date, Kind, NormalHours, OvertimeHours, Leave);
}

/// <summary>ผลงานต่อชิ้น เช่น จำนวนกล่องที่แพ็ค</summary>
public sealed class PieceWorkEntry : TenantEntity, IAudited
{
    public Guid EmployeeId { get; set; }
    public Employee? Employee { get; set; }
    public DateOnly Date { get; set; }
    public required string Description { get; set; }
    public decimal Quantity { get; set; }
    public decimal Rate { get; set; }
    public bool Overtime { get; set; }
    public WorkSource Source { get; set; }
    public string? Note { get; set; }

    public PieceEntry ToPieceEntry() => new(Date, Description, Quantity, Rate, Overtime);
}

/// <summary>เงินเบิกล่วงหน้า — ยอดค้าง = ผลรวมเงินเบิก − ที่หักไปแล้วใน pay run ที่ lock แล้ว</summary>
public sealed class Advance : TenantEntity, IAudited
{
    public Guid EmployeeId { get; set; }
    public Employee? Employee { get; set; }
    public DateOnly Date { get; set; }
    public decimal Amount { get; set; }
    public string? Note { get; set; }
}

/// <summary>วันหยุดนักขัตฤกษ์/วันหยุดประเพณีของร้าน (ร้านเลือกเองได้ตามกฎหมาย อย่างน้อยปีละ 13 วัน)</summary>
public sealed class Holiday : TenantEntity, IAudited
{
    public DateOnly Date { get; set; }
    public required string Name { get; set; }
}

/// <summary>
/// ยอดสะสมของปีก่อนเริ่มใช้ระบบ (หรือจากนายจ้างเดิม) — ไม่มีแล้วเริ่มกลางปี ภาษีหัก ณ ที่จ่ายจะประมาณต่ำไป
/// </summary>
public sealed class OpeningBalance : TenantEntity, IAudited
{
    public Guid EmployeeId { get; set; }
    public int Year { get; set; }
    public decimal TaxableIncome { get; set; }
    public decimal TaxWithheld { get; set; }
    public decimal SocialSecurity { get; set; }
    public string? Note { get; set; }
}

public sealed class AuditLog : TenantEntity
{
    public Guid? UserId { get; set; }
    public required string Action { get; set; }
    public required string EntityType { get; set; }
    public Guid EntityId { get; set; }

    /// <summary>JSON: ค่าที่เพิ่ม/ลบ หรือ { field: [old, new] } สำหรับการแก้ไข</summary>
    public required string Changes { get; set; }
}
