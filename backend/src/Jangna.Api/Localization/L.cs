using System.Globalization;
using Jangna.Payroll.Engine.Model;

namespace Jangna.Api.Localization;

/// <summary>
/// ข้อความสองภาษาแบบเดียวกับ t("ไทย", "English") ของ frontend — เลือกตาม Accept-Language ของ request (ค่าเริ่มต้นไทย)
///   L.T("ไม่พบพนักงาน", "Employee not found")
/// เปลี่ยนแค่ UICulture: CurrentCulture คงเดิม ไม่งั้น th-TH จะ format วันที่เป็น พ.ศ. และกระทบการ parse ตัวเลข/วันที่
/// </summary>
public static class L
{
    private static readonly CultureInfo Thai = CultureInfo.GetCultureInfo("th");
    private static readonly CultureInfo English = CultureInfo.GetCultureInfo("en");

    public static bool IsEnglish => CultureInfo.CurrentUICulture.TwoLetterISOLanguageName == "en";

    public static string T(string th, string en) => IsEnglish ? en : th;

    public static string T(LocalizedText text) => T(text.Th, text.En);

    /// <summary>ภาษาแรกใน Accept-Language ที่รองรับ (en / th) — ไม่มีหรือไม่รู้จัก = ไทย</summary>
    public static IApplicationBuilder UseRequestLanguage(this IApplicationBuilder app) =>
        app.Use(async (context, next) =>
        {
            var preferred = context.Request.GetTypedHeaders().AcceptLanguage
                .OrderByDescending(l => l.Quality ?? 1)
                .Select(l => l.Value.Value?.Split('-')[0].ToLowerInvariant())
                .FirstOrDefault(l => l is "th" or "en");
            CultureInfo.CurrentUICulture = preferred == "en" ? English : Thai;
            await next(context);
        });
}
