namespace Jangna.Core.Entities;

public enum PayType
{
    Monthly,
    Daily,
    Hourly,
    Piece,
}

public enum WorkerType
{
    Employee,
    Freelance,
}

/// <summary>คำนำหน้าชื่อ — ใช้ใน สปส.1-10 (รหัส 003/005/004) และ ภ.ง.ด.1</summary>
public enum Title
{
    Mr,
    Mrs,
    Miss,
}

public enum EmployeeStatus
{
    Active,
    Inactive,
}

public sealed class Employee : TenantEntity, IAudited
{
    public Title? Title { get; set; }
    public required string FirstName { get; set; }
    public string LastName { get; set; } = "";
    public string? Nickname { get; set; }
    public string? Phone { get; set; }

    /// <summary>เลขประจำตัวประชาชน 13 หลัก (= เลขประกันสังคม และเลขผู้เสียภาษี) — แรงงานต่างด้าวใช้เลขที่ สปส. ออกให้</summary>
    public string? NationalId { get; set; }

    // ที่อยู่ — ภ.ง.ด.1 บังคับ อำเภอ/จังหวัด/รหัสไปรษณีย์
    public string? AddressLine { get; set; }
    public string? Subdistrict { get; set; }
    public string? District { get; set; }
    public string? Province { get; set; }
    public string? PostalCode { get; set; }

    /// <summary>นโยบายการทำงาน (คนละ 1 อัน) — ว่าง = ไม่มีกะประจำ</summary>
    public Guid? WorkPolicyId { get; set; }
    public WorkPolicy? WorkPolicy { get; set; }

    public Guid? BranchId { get; set; }
    public Branch? Branch { get; set; }

    public PayType PayType { get; set; }

    /// <summary>บาท/เดือน, บาท/วัน หรือ บาท/ชั่วโมง ตาม PayType (Piece ใช้เป็นค่าแรงรายวันพื้นฐาน ถ้ามี)</summary>
    public decimal BaseRate { get; set; }

    public WorkerType WorkerType { get; set; }
    public EmployeeStatus Status { get; set; }

    /// <summary>ภาษาที่ใช้ใน LINE: th / en / my</summary>
    public string Language { get; set; } = "th";

    public string? LineUserId { get; set; }
    public DateTimeOffset? LineLinkedAt { get; set; }
}

/// <summary>ลิงก์เชิญให้พนักงานผูกบัญชี LINE ใช้ได้ครั้งเดียว</summary>
public sealed class EmployeeInvite : TenantEntity
{
    public Guid EmployeeId { get; set; }
    public Employee? Employee { get; set; }
    public required string Code { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? UsedAt { get; set; }

    public bool IsUsable(DateTimeOffset now) => UsedAt is null && now < ExpiresAt;
}

public enum DocumentType
{
    Passport,
    Visa,
    WorkPermit,
    PinkCard,
    Other,
}

/// <summary>เอกสารของพนักงาน (แรงงานต่างด้าว: พาสปอร์ต วีซ่า ใบอนุญาตทำงาน บัตรชมพู) — ใช้แจ้งเตือนก่อนหมดอายุ ยังไม่เก็บไฟล์สแกน</summary>
public sealed class EmployeeDocument : TenantEntity, IAudited
{
    public Guid EmployeeId { get; set; }
    public Employee? Employee { get; set; }
    public DocumentType Type { get; set; }
    public string? Number { get; set; }
    public DateOnly? IssuedOn { get; set; }

    /// <summary>ไม่มีวันหมดอายุ = null (ไม่แจ้งเตือน)</summary>
    public DateOnly? ExpiresOn { get; set; }

    public string? Note { get; set; }
}
