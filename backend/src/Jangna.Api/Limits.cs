namespace Jangna.Api;

/// <summary>ขีดจำกัดข้อมูลที่ต้องตรงกับขนาดคอลัมน์ใน DB (ดู JangnaDbContext) — เกินแล้ว Postgres ปฏิเสธ → ต้องกันที่ validation ให้ตอบ 400 แทน 500</summary>
public static class Limits
{
    /// <summary>numeric(12,2)</summary>
    public const decimal Money = 9_999_999_999.99m;

    /// <summary>numeric(14,2)</summary>
    public const decimal BigMoney = 999_999_999_999.99m;

    /// <summary>numeric(12,4)</summary>
    public const decimal Rate = 99_999_999.9999m;
}
