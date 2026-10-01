namespace Jangna.Core.Tenancy;

public interface ITenantContext
{
    /// <summary>null = ไม่มี tenant (เช่น request ที่ไม่ได้ login) → query ข้อมูลของ tenant จะไม่เห็นอะไรเลย</summary>
    Guid? TenantId { get; }
}

public sealed class FixedTenantContext(Guid? tenantId) : ITenantContext
{
    public Guid? TenantId { get; } = tenantId;
}
