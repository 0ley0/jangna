namespace Jangna.Core.Entities;

/// <summary>แม่แบบกะงาน เช่น "กะเช้า 08:00–17:00 พัก 60 นาที" — เวลาท้องถิ่นของร้าน (ไทย)</summary>
public sealed class ShiftTemplate : TenantEntity, IAudited
{
    public required string Name { get; set; }
    public TimeOnly StartTime { get; set; }

    /// <summary>น้อยกว่า StartTime = ข้ามเที่ยงคืน (เลิกวันถัดไป)</summary>
    public TimeOnly EndTime { get; set; }

    public int BreakMinutes { get; set; }

    /// <summary>สีของ Chip ในตารางกะ: brand / sage / amber / plum / blue / neutral</summary>
    public string Color { get; set; } = "brand";

    /// <summary>เลิกใช้แล้ว — ซ่อนจากตัวเลือก แต่กะที่จัดไปแล้วยังอ้างถึงได้</summary>
    public bool Archived { get; set; }
}

/// <summary>
/// กะของพนักงาน 1 คน 1 วัน — คัดลอกเวลาจากแม่แบบมาเก็บไว้ แก้แม่แบบทีหลังจะไม่เปลี่ยนกะที่จัดไปแล้ว
/// ยังไม่ส่งผลต่อเงินเดือน (ใช้เทียบกับการลงเวลาเมื่อมีระบบลงเวลา)
/// </summary>
public sealed class Shift : TenantEntity, IAudited
{
    public Guid EmployeeId { get; set; }
    public Employee? Employee { get; set; }
    public DateOnly Date { get; set; }
    public Guid? ShiftTemplateId { get; set; }
    public ShiftTemplate? ShiftTemplate { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public int BreakMinutes { get; set; }
    public string? Note { get; set; }

    /// <summary>ชั่วโมงทำงาน (หักพัก) — รองรับกะข้ามเที่ยงคืน</summary>
    public decimal Hours => WorkHours(StartTime, EndTime, BreakMinutes);

    public static decimal WorkHours(TimeOnly start, TimeOnly end, int breakMinutes)
    {
        var minutes = (end.ToTimeSpan() - start.ToTimeSpan()).TotalMinutes;
        if (minutes <= 0) minutes += 24 * 60;
        return Math.Max(0, (decimal)(minutes - breakMinutes)) / 60m;
    }
}
