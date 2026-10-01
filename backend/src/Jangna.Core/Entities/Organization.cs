namespace Jangna.Core.Entities;

public enum Role
{
    Owner,
    Manager,
    Staff,
}

public sealed class Tenant : Entity
{
    public required string Name { get; set; }
}

public sealed class User : Entity
{
    public required string Email { get; set; }
    public required string DisplayName { get; set; }
    public string PasswordHash { get; set; } = "";
    public string? LineUserId { get; set; }
}

/// <summary>ผู้ใช้ 1 คนอยู่ได้หลาย tenant โดยมี role ต่อ tenant</summary>
public sealed class Membership : TenantEntity
{
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public Role Role { get; set; }
}

public sealed class Branch : TenantEntity
{
    public required string Name { get; set; }

    /// <summary>ISO 3166-2:TH เช่น "TH-10" ใช้หาค่าแรงขั้นต่ำ</summary>
    public required string ProvinceCode { get; set; }

    /// <summary>อำเภอ/พื้นที่ที่มีอัตราค่าแรงพิเศษ (ถ้ามี)</summary>
    public string? AreaCode { get; set; }

    public double? GeoLat { get; set; }
    public double? GeoLng { get; set; }
    public int GeoRadiusMeters { get; set; } = 150;
}
