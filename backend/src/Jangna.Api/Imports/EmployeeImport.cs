using ClosedXML.Excel;
using Jangna.Api.Endpoints;
using Jangna.Api.Localization;
using Jangna.Core.Entities;
using Jangna.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using EmployeeRequest = Jangna.Api.Endpoints.EmployeeEndpoints.EmployeeRequest;

namespace Jangna.Api.Imports;

/// <summary>
/// นำเข้าพนักงานจาก Excel (.xlsx) — แม่แบบดาวน์โหลดจาก /api/employees/import/template
/// อ่านตามลำดับคอลัมน์ (หัวตารางแถว 1 เป็นแค่คำอธิบาย) ใช้กฎตรวจเดียวกับฟอร์มเพิ่มพนักงานทีละคน
/// ทั้งไฟล์สำเร็จหรือไม่สำเร็จทั้งไฟล์ (มีแถวผิดแถวเดียว = ไม่เพิ่มใครเลย)
/// </summary>
public static class EmployeeImport
{
    public const int MaxRows = 500;
    public const long MaxBytes = 2 * 1024 * 1024;

    private const string DataSheet = "พนักงาน";

    public sealed record RowResult(int Row, string Name, IReadOnlyList<string> Errors);

    public sealed record Report(int Total, int Valid, int Imported, IReadOnlyList<RowResult> Rows);

    public sealed class ImportException(string message, int status = 400) : Exception(message)
    {
        public int Status { get; } = status;
    }

    // ลำดับคอลัมน์ (1-based) — ตรงกับแม่แบบ
    private enum Col
    {
        FirstName = 1, LastName, Nickname, Phone, Branch, PayType, Rate, WorkerType, Language,
        Title, NationalId, AddressLine, Subdistrict, District, Province, PostalCode, WorkPolicy,
    }

    private static readonly string[] Headers =
    [
        "ชื่อ * (First name)", "นามสกุล (Last name)", "ชื่อเล่น (Nickname)", "เบอร์โทร (Phone)", "สาขา (Branch)",
        "รูปแบบค่าจ้าง * (Pay type)", "อัตรา (Rate)", "สถานะการจ้าง (Employment)", "ภาษา (Language)",
        "คำนำหน้า (Title)", "เลขประจำตัวประชาชน (National ID)", "บ้านเลขที่/ถนน (Address)", "ตำบล/แขวง (Subdistrict)",
        "อำเภอ/เขต (District)", "จังหวัด (Province)", "รหัสไปรษณีย์ (Postal code)", "นโยบายการทำงาน (Work policy)",
    ];

    private static readonly string[] PayTypeChoices = ["รายเดือน", "รายวัน", "รายชั่วโมง", "ต่อชิ้น"];
    private static readonly string[] WorkerChoices = ["ลูกจ้าง", "ฟรีแลนซ์"];
    private static readonly string[] LanguageChoices = ["th", "en", "my"];
    private static readonly string[] TitleChoices = ["นาย", "นาง", "นางสาว"];

    // ---------- template ----------

    public static byte[] BuildTemplate(IReadOnlyList<string> branchNames, IReadOnlyList<string> policyNames)
    {
        using var wb = new XLWorkbook();
        var ws = wb.AddWorksheet(DataSheet);

        for (var i = 0; i < Headers.Length; i++)
        {
            var cell = ws.Cell(1, i + 1);
            cell.Value = Headers[i];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#FBE6D7");
            cell.Style.Alignment.WrapText = true;
            cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            ws.Column(i + 1).Width = i is (int)Col.NationalId - 1 ? 26 : 18;
        }
        ws.Row(1).Height = 34;
        ws.SheetView.FreezeRows(1);

        // คอลัมน์ตัวเลขที่ขึ้นต้นด้วย 0 ได้ ต้องเป็น Text ไม่งั้น Excel ตัด 0 ทิ้ง
        foreach (var c in new[] { Col.Phone, Col.NationalId, Col.PostalCode })
            ws.Column((int)c).Style.NumberFormat.Format = "@";

        List(ws, Col.PayType, PayTypeChoices);
        List(ws, Col.WorkerType, WorkerChoices);
        List(ws, Col.Language, LanguageChoices);
        List(ws, Col.Title, TitleChoices);
        if (branchNames.Count > 0) List(ws, Col.Branch, branchNames);
        if (policyNames.Count > 0) List(ws, Col.WorkPolicy, policyNames);

        var help = wb.AddWorksheet("วิธีกรอก (Guide)");
        help.Column(1).Width = 30;
        help.Column(2).Width = 90;
        var lines = new (string, string)[]
        {
            ("วิธีใช้", "กรอกพนักงานคนละแถวในชีต \"พนักงาน\" เริ่มที่แถว 2 (แถว 1 เป็นหัวตาราง ห้ามลบ/สลับคอลัมน์) แล้วอัปโหลดที่หน้าพนักงาน → นำเข้าจาก Excel"),
            ("How to", "One employee per row on the \"พนักงาน\" sheet from row 2 (row 1 is the header — do not delete or reorder columns), then upload it on Employees → Import from Excel"),
            ("ชื่อ *", "จำเป็น"),
            ("รูปแบบค่าจ้าง *", "รายเดือน / รายวัน / รายชั่วโมง / ต่อชิ้น (หรือ Monthly / Daily / Hourly / Piece)"),
            ("อัตรา", "บาทต่อเดือน/วัน/ชั่วโมง ตามรูปแบบค่าจ้าง — จำเป็นทุกแบบยกเว้น \"ต่อชิ้น\""),
            ("สถานะการจ้าง", "ลูกจ้าง (เข้าประกันสังคม) หรือ ฟรีแลนซ์ — ว่าง = ลูกจ้าง (Employee / Freelance)"),
            ("ภาษา", "th / en / my — ว่าง = th (ภาษาใน LINE และสลิป)"),
            ("สาขา", "ต้องตรงกับชื่อสาขาที่สร้างไว้ในระบบ — ว่าง = ไม่ระบุ"),
            ("คำนำหน้า", "นาย / นาง / นางสาว (Mr / Mrs / Miss) — ใช้ในไฟล์ สปส. และ ภ.ง.ด."),
            ("เลขประจำตัวประชาชน", "13 หลัก (ใส่ขีดได้) ตรวจ check digit และห้ามซ้ำกับพนักงานเดิม/แถวอื่นในไฟล์"),
            ("นโยบายการทำงาน", "ต้องตรงกับชื่อนโยบายที่สร้างไว้ในระบบ (หน้านโยบายงาน) — ว่าง = ไม่กำหนด ใช้สร้างตารางกะอัตโนมัติ"),
            ("ที่อยู่", "ภ.ง.ด.1 ต้องมี อำเภอ/เขต จังหวัด รหัสไปรษณีย์ 5 หลัก — ไม่บังคับตอนนำเข้า แต่ต้องมีก่อนออกไฟล์ยื่นแบบ"),
            ("จำกัด", $"ไม่เกิน {MaxRows} แถวต่อไฟล์ ขนาดไม่เกิน 2 MB ถ้ามีแถวผิดแม้แถวเดียว จะไม่นำเข้าเลย — แก้ไฟล์แล้วอัปโหลดใหม่"),
            ("ตัวอย่าง (Example)", "สมชาย | ใจดี | ชาย | 0812345678 | (สาขา) | รายวัน | 400 | ลูกจ้าง | th | นาย | 1101700203450 | 12/3 หมู่ 4 | พญาไท | ราชเทวี | กรุงเทพมหานคร | 10400"),
        };
        for (var i = 0; i < lines.Length; i++)
        {
            help.Cell(i + 1, 1).Value = lines[i].Item1;
            help.Cell(i + 1, 1).Style.Font.Bold = true;
            help.Cell(i + 1, 2).Value = lines[i].Item2;
            help.Cell(i + 1, 2).Style.Alignment.WrapText = true;
            help.Cell(i + 1, 1).Style.Alignment.Vertical = XLAlignmentVerticalValues.Top;
        }

        using var stream = new MemoryStream();
        wb.SaveAs(stream);
        return stream.ToArray();
    }

    private static void List(IXLWorksheet ws, Col col, IEnumerable<string> choices)
    {
        var range = ws.Range(2, (int)col, MaxRows + 1, (int)col);
        range.CreateDataValidation().List(string.Join(",", choices.Select(c => c.Replace(",", " "))), true);
        range.GetDataValidation().IgnoreBlanks = true;
        // ไม่บังคับ strict — ยังพิมพ์ภาษาอังกฤษได้ ระบบตรวจตอนนำเข้าอยู่แล้ว
        range.GetDataValidation().ErrorStyle = XLErrorStyle.Warning;
    }

    // ---------- import ----------

    public static async Task<Report> RunAsync(Stream file, bool commit, JangnaDbContext db, CancellationToken ct)
    {
        XLWorkbook wb;
        try
        {
            wb = new XLWorkbook(file);
        }
        catch (Exception)
        {
            throw new ImportException(L.T("อ่านไฟล์ไม่ได้ — ต้องเป็นไฟล์ Excel (.xlsx) จากแม่แบบของระบบ", "Cannot read the file — it must be an Excel (.xlsx) file from the template"));
        }

        using (wb)
        {
            var ws = wb.Worksheets.FirstOrDefault(s => s.Name == DataSheet) ?? wb.Worksheets.First();
            var last = ws.LastRowUsed()?.RowNumber() ?? 1;
            if (last < 2) throw new ImportException(L.T("ไม่พบข้อมูลพนักงานในไฟล์ (เริ่มกรอกที่แถว 2)", "No employees found in the file (start at row 2)"));
            if (last - 1 > MaxRows) throw new ImportException(L.T($"นำเข้าได้ไม่เกิน {MaxRows} แถวต่อไฟล์", $"At most {MaxRows} rows per file"));

            var branches = await db.Branches.AsNoTracking().ToListAsync(ct);
            var policies = await db.WorkPolicies.AsNoTracking().Where(p => !p.Archived).ToListAsync(ct);
            var seenIds = new Dictionary<string, int>();

            var results = new List<RowResult>();
            var valid = new List<EmployeeRequest>();
            for (var r = 2; r <= last; r++)
            {
                var row = ws.Row(r);
                if (row.IsEmpty(XLCellsUsedOptions.Contents)) continue;
                string Get(Col c) => Cell(row.Cell((int)c));

                var errors = new List<string>();
                var first = Get(Col.FirstName);
                var name = $"{first} {Get(Col.LastName)}".Trim();

                var payType = Map(Get(Col.PayType), PayTypeMap);
                if (payType is null)
                    errors.Add(L.T("รูปแบบค่าจ้าง: ใช้ รายเดือน / รายวัน / รายชั่วโมง / ต่อชิ้น", "Pay type: use Monthly / Daily / Hourly / Piece"));
                var workerType = Get(Col.WorkerType) is "" ? WorkerType.Employee : Map(Get(Col.WorkerType), WorkerMap);
                if (workerType is null)
                    errors.Add(L.T("สถานะการจ้าง: ใช้ ลูกจ้าง หรือ ฟรีแลนซ์", "Employment: use Employee or Freelance"));

                decimal rate = 0;
                if (Get(Col.Rate) is { Length: > 0 } rateText &&
                    !decimal.TryParse(rateText.Replace(",", ""), System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out rate))
                    errors.Add(L.T("อัตราต้องเป็นตัวเลข", "Rate must be a number"));

                Title? title = null;
                if (Get(Col.Title) is { Length: > 0 } titleText)
                {
                    title = Map(titleText, TitleMap);
                    if (title is null) errors.Add(L.T("คำนำหน้า: ใช้ นาย / นาง / นางสาว", "Title: use Mr / Mrs / Miss"));
                }

                Guid? branchId = null;
                if (Get(Col.Branch) is { Length: > 0 } branchName)
                {
                    var branch = branches.FirstOrDefault(b => string.Equals(b.Name.Trim(), branchName, StringComparison.OrdinalIgnoreCase));
                    if (branch is null) errors.Add(L.T($"ไม่พบสาขา \"{branchName}\" — ต้องตรงกับชื่อสาขาในระบบ", $"Branch \"{branchName}\" not found — it must match a branch name in the system"));
                    else branchId = branch.Id;
                }

                Guid? policyId = null;
                if (Get(Col.WorkPolicy) is { Length: > 0 } policyName)
                {
                    var policy = policies.FirstOrDefault(p => string.Equals(p.Name.Trim(), policyName, StringComparison.OrdinalIgnoreCase));
                    if (policy is null) errors.Add(L.T($"ไม่พบนโยบายการทำงาน \"{policyName}\" — ต้องตรงกับชื่อในระบบ", $"Work policy \"{policyName}\" not found — it must match a policy name in the system"));
                    else policyId = policy.Id;
                }

                var language = Get(Col.Language).ToLowerInvariant();
                var request = new EmployeeRequest(first, Get(Col.LastName), Get(Col.Nickname), Get(Col.Phone), branchId,
                    payType ?? PayType.Monthly, rate, workerType ?? WorkerType.Employee, language is "" ? null : language,
                    title, Get(Col.NationalId), Get(Col.AddressLine), Get(Col.Subdistrict), Get(Col.District), Get(Col.Province), Get(Col.PostalCode), policyId);

                // ตรวจด้วยกฎเดียวกับฟอร์ม (ซ้ำกับพนักงานที่มีอยู่ใน DB รวมอยู่แล้ว) แล้วเติมกฎเฉพาะไฟล์: ซ้ำกันเองในไฟล์
                foreach (var message in (await EmployeeEndpoints.ValidationErrorsAsync(request, null, db, ct)).Values.SelectMany(v => v))
                    errors.Add(message);
                if (EmployeeEndpoints.Clean(request.NationalId) is { } nid)
                {
                    if (seenIds.TryGetValue(nid, out var firstRow))
                        errors.Add(L.T($"เลขประจำตัวประชาชนซ้ำกับแถว {firstRow} ในไฟล์", $"National ID is repeated from row {firstRow} in this file"));
                    else seenIds[nid] = r;
                }

                results.Add(new RowResult(r, name, errors));
                if (errors.Count == 0) valid.Add(request);
            }

            if (results.Count == 0) throw new ImportException(L.T("ไม่พบข้อมูลพนักงานในไฟล์ (เริ่มกรอกที่แถว 2)", "No employees found in the file (start at row 2)"));

            var imported = 0;
            if (commit && results.All(x => x.Errors.Count == 0))
            {
                foreach (var request in valid)
                {
                    var employee = new Employee { FirstName = request.FirstName.Trim() };
                    EmployeeEndpoints.Apply(employee, request);
                    db.Employees.Add(employee);
                }
                await db.SaveChangesAsync(ct);
                imported = valid.Count;
            }
            return new Report(results.Count, valid.Count, imported, results);
        }
    }

    private static string Cell(IXLCell cell) => cell.IsEmpty() ? "" : cell.GetFormattedString().Trim();

    private static readonly Dictionary<string, PayType> PayTypeMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["รายเดือน"] = PayType.Monthly, ["monthly"] = PayType.Monthly,
        ["รายวัน"] = PayType.Daily, ["daily"] = PayType.Daily,
        ["รายชั่วโมง"] = PayType.Hourly, ["hourly"] = PayType.Hourly,
        ["ต่อชิ้น"] = PayType.Piece, ["piece"] = PayType.Piece,
    };

    private static readonly Dictionary<string, WorkerType> WorkerMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["ลูกจ้าง"] = WorkerType.Employee, ["employee"] = WorkerType.Employee,
        ["ฟรีแลนซ์"] = WorkerType.Freelance, ["freelance"] = WorkerType.Freelance, ["freelancer"] = WorkerType.Freelance,
    };

    private static readonly Dictionary<string, Title> TitleMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["นาย"] = Title.Mr, ["mr"] = Title.Mr, ["นาง"] = Title.Mrs, ["mrs"] = Title.Mrs, ["นางสาว"] = Title.Miss, ["miss"] = Title.Miss,
    };

    private static T? Map<T>(string text, Dictionary<string, T> map) where T : struct =>
        map.TryGetValue(text.Trim(), out var value) ? value : null;
}
