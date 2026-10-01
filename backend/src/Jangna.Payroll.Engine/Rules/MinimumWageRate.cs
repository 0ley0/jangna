namespace Jangna.Payroll.Engine.Rules;

/// <summary>
/// ค่าแรงขั้นต่ำรายวัน ProvinceCode ใช้ ISO 3166-2:TH (เช่น "TH-10" = กรุงเทพฯ)
/// AreaCode = อำเภอ/พื้นที่ที่มีอัตราพิเศษ (เช่น อ.หาดใหญ่) — null หมายถึงทั้งจังหวัด
/// </summary>
public sealed record MinimumWageRate(
    string ProvinceCode,
    string? AreaCode,
    decimal DailyRate,
    DateOnly EffectiveFrom,
    bool Verified);
