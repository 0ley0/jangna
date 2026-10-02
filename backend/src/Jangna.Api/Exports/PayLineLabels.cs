using System.Text.RegularExpressions;
using Jangna.Payroll.Engine.Model;

namespace Jangna.Api.Exports;

/// <summary>ชื่อรายการในสลิปตามรหัสจาก payroll engine — ชุดเดียวกับ payLineLabels ใน frontend/src/lib/types.ts</summary>
public static partial class PayLineLabels
{
    private static readonly Dictionary<string, LocalizedText> Labels = new()
    {
        [LineCodes.Salary] = new("เงินเดือน", "Salary"),
        [LineCodes.UnpaidAbsence] = new("หักวันขาด/ลาไม่รับค่าจ้าง", "Unpaid absence"),
        [LineCodes.DailyWage] = new("ค่าจ้างรายวัน", "Daily wage"),
        [LineCodes.HourlyWage] = new("ค่าจ้างรายชั่วโมง", "Hourly wage"),
        [LineCodes.Piece] = new("ค่าจ้างต่อชิ้น", "Piece rate"),
        [LineCodes.PieceOvertime] = new("ค่าจ้างต่อชิ้น (OT)", "Piece rate (OT)"),
        [LineCodes.PieceHoliday] = new("ค่าจ้างต่อชิ้น (วันหยุด)", "Piece rate (holiday)"),
        [LineCodes.PieceHolidayOvertime] = new("ค่าจ้างต่อชิ้น (OT วันหยุด)", "Piece rate (holiday OT)"),
        [LineCodes.Overtime] = new("ค่าล่วงเวลา", "Overtime"),
        [LineCodes.HolidayWork] = new("ค่าทำงานวันหยุด", "Holiday work"),
        [LineCodes.HolidayOvertime] = new("ค่าล่วงเวลาวันหยุด", "Holiday overtime"),
        [LineCodes.PublicHolidayPay] = new("ค่าจ้างวันหยุดนักขัตฤกษ์", "Public holiday pay"),
        [LineCodes.PaidLeave] = new("ลาได้รับค่าจ้าง", "Paid leave"),
        [LineCodes.MinimumWageTopUp] = new("เติมให้ถึงค่าแรงขั้นต่ำ", "Minimum wage top-up"),
        [LineCodes.SocialSecurity] = new("ประกันสังคม", "Social security"),
        [LineCodes.WithholdingTax] = new("ภาษีหัก ณ ที่จ่าย", "Withholding tax"),
        [LineCodes.Advance] = new("หักเงินเบิกล่วงหน้า", "Advance deduction"),
    };

    /// <summary>
    /// ไทย = description เดิมจาก engine (มีรายละเอียด เช่น ชื่องานต่อชิ้น)
    /// อังกฤษ = ชื่อจากรหัส + วันที่ dd/MM ท้าย description (ถ้ามี) — แบบเดียวกับ englishLine() ใน frontend
    /// </summary>
    public static string Describe(PayLine line, bool english)
    {
        if (!english) return line.Description;
        var label = Labels.TryGetValue(line.Code, out var text) ? text.En : line.Description;
        return TrailingDate().Match(line.Description) is { Success: true } m ? $"{label} {m.Value}" : label;
    }

    [GeneratedRegex(@"\d{2}/\d{2}$")]
    private static partial Regex TrailingDate();
}
