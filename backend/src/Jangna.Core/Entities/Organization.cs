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

    // ---------- ข้อมูลนายจ้างสำหรับยื่นแบบ (ไม่บังคับจนกว่าจะ export) ----------

    /// <summary>ชื่อจดทะเบียน/ชื่อสถานประกอบการตามที่ สปส./สรรพากร รู้จัก (ว่าง = ใช้ Name)</summary>
    public string? LegalName { get; set; }

    /// <summary>ที่อยู่ที่พิมพ์บนสลิป</summary>
    public string? Address { get; set; }

    /// <summary>เลขประจำตัวผู้เสียภาษี 13 หลัก (บุคคลธรรมดา = เลขบัตรประชาชน)</summary>
    public string? TaxId { get; set; }

    /// <summary>สาขาตาม ภ.พ.20 6 หลัก — สำนักงานใหญ่ = 000000</summary>
    public string TaxBranchNo { get; set; } = "000000";

    /// <summary>เลขที่บัญชีนายจ้าง สปส. 10 หลัก</summary>
    public string? SsoAccountNo { get; set; }

    /// <summary>ลำดับที่สาขา สปส. 6 หลัก — สำนักงานใหญ่ = 000000</summary>
    public string SsoBranchNo { get; set; } = "000000";

    /// <summary>User ID ระบบยื่นแบบออนไลน์ของกรมสรรพากร — ใส่ในไฟล์ ภ.ง.ด.1 (USER_ID)</summary>
    public string? RdUserId { get; set; }

    public string DisplayName => string.IsNullOrWhiteSpace(LegalName) ? Name : LegalName;
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
