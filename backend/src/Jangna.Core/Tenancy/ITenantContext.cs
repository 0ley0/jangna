namespace Jangna.Core.Tenancy;

public interface ITenantContext
{
    /// <summary>null = ไม่มี tenant (เช่น request ที่ไม่ได้ login) → query ข้อมูลของ tenant จะไม่เห็นอะไรเลย</summary>
    Guid? TenantId { get; }

    /// <summary>ผู้ใช้ที่ทำ request (ใช้ใน audit log) — null = ระบบ/ไม่ได้ login</summary>
    Guid? UserId { get; }
}

public sealed class FixedTenantContext(Guid? tenantId, Guid? userId = null) : ITenantContext
{
    public Guid? TenantId { get; } = tenantId;
    public Guid? UserId { get; } = userId;
}
