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

public enum EmployeeStatus
{
    Active,
    Inactive,
}

public sealed class Employee : TenantEntity
{
    public required string FirstName { get; set; }
    public string LastName { get; set; } = "";
    public string? Nickname { get; set; }
    public string? Phone { get; set; }

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
