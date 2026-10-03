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

/// <summary>
/// นโยบายการทำงาน (Work Policy) — ตั้งชื่อ แล้วกำหนดให้พนักงาน (คนละ 1 นโยบาย) ใช้สร้างตารางกะอัตโนมัติ
/// แพทเทิร์นเป็นรอบ <see cref="CycleWeeks"/> สัปดาห์ (1 = ซ้ำทุกสัปดาห์, 2+ = กะหมุนเวียน) แต่ละวันในรอบอ้างถึงแม่แบบกะ ไม่มีแถว = หยุด
/// ต่อยอดภายหลังได้ (ผ่อนผันมาสาย กฎ OT ฯลฯ) โดยเพิ่มคอลัมน์ในตารางนี้
/// </summary>
public sealed class WorkPolicy : TenantEntity, IAudited
{
    public required string Name { get; set; }
    public string? Description { get; set; }

    /// <summary>จำนวนสัปดาห์ในหนึ่งรอบ (1–8)</summary>
    public int CycleWeeks { get; set; } = 1;

    /// <summary>วันจันทร์ที่เริ่มสัปดาห์แรกของรอบ — สัปดาห์ใดอยู่ตรงไหนของรอบนับจากวันนี้ (ย้อนหลังก็ได้)</summary>
    public DateOnly AnchorDate { get; set; }

    /// <summary>เลิกใช้แล้ว — ซ่อนจากตัวเลือก พนักงานที่ใช้อยู่ยังอ้างถึงได้</summary>
    public bool Archived { get; set; }

    public List<WorkPolicyDay> Days { get; set; } = [];

    /// <summary>กะของวันที่กำหนด (null = หยุด) — สัปดาห์ที่เท่าไรของรอบหาจาก AnchorDate</summary>
    public Guid? TemplateOn(DateOnly date)
    {
        var weekIndex = WeekIndexOf(date);
        var dayIndex = ((int)date.DayOfWeek + 6) % 7; // 0 = จันทร์
        return Days.FirstOrDefault(d => d.WeekIndex == weekIndex && d.DayIndex == dayIndex)?.ShiftTemplateId;
    }

    public int WeekIndexOf(DateOnly date)
    {
        var anchorMonday = MondayOf(AnchorDate);
        var weeks = (MondayOf(date).DayNumber - anchorMonday.DayNumber) / 7;
        return ((weeks % CycleWeeks) + CycleWeeks) % CycleWeeks;
    }

    public static DateOnly MondayOf(DateOnly date) => date.AddDays(-(((int)date.DayOfWeek + 6) % 7));
}

/// <summary>หนึ่งวันในแพทเทิร์น: สัปดาห์ที่ WeekIndex (0-based) วันที่ DayIndex (0 = จันทร์ … 6 = อาทิตย์) ทำกะนี้</summary>
public sealed class WorkPolicyDay : TenantEntity
{
    public Guid WorkPolicyId { get; set; }
    public int WeekIndex { get; set; }
    public int DayIndex { get; set; }
    public Guid ShiftTemplateId { get; set; }
    public ShiftTemplate? ShiftTemplate { get; set; }
}
