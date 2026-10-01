namespace Jangna.Core.Entities;

public abstract class Entity
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>ข้อมูลที่เป็นของ tenant — ถูกกรองด้วย global query filter และเติม TenantId อัตโนมัติตอน save</summary>
public interface ITenantOwned
{
    Guid TenantId { get; set; }
}

public abstract class TenantEntity : Entity, ITenantOwned
{
    public Guid TenantId { get; set; }
}
