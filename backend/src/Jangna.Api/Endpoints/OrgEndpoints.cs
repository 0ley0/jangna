using System.Security.Claims;
using Jangna.Api.Auth;
using Jangna.Api.Localization;
using Jangna.Core.Entities;
using Jangna.Core.Tenancy;
using Jangna.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jangna.Api.Endpoints;

public static class OrgEndpoints
{
    public sealed record MeResponse(Guid UserId, string Email, string DisplayName, Guid TenantId, string TenantName, string Role);

    public sealed record BranchRequest(
        string Name, string ProvinceCode, string? AreaCode, double? GeoLat, double? GeoLng, int? GeoRadiusMeters);

    public sealed record BranchDto(
        Guid Id, string Name, string ProvinceCode, string? AreaCode, double? GeoLat, double? GeoLng, int GeoRadiusMeters);

    /// <summary>ข้อมูลร้านสำหรับสลิปและเอกสารนำส่ง สปส./สรรพากร</summary>
    public sealed record ShopDto(
        string Name, string? LegalName, string? Address, string? TaxId, string TaxBranchNo,
        string? SsoAccountNo, string SsoBranchNo, string? RdUserId);

    public static RouteGroupBuilder MapOrgEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/shop", async (ITenantContext tenant, JangnaDbContext db, CancellationToken ct) =>
            await db.Tenants.SingleOrDefaultAsync(t => t.Id == tenant.TenantId, ct) is { } shop
                ? Results.Ok(ToDto(shop))
                : Results.NotFound());

        api.MapPut("/shop", async (ShopDto req, ITenantContext tenant, JangnaDbContext db, CancellationToken ct) =>
        {
            var errors = new Dictionary<string, string[]>();
            if (string.IsNullOrWhiteSpace(req.Name)) errors["name"] = [L.T("กรุณากรอกชื่อร้าน", "Shop name is required")];
            if (!OptionalDigits(req.TaxId, 13)) errors["taxId"] = [L.T("เลขผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก", "Tax ID must be 13 digits")];
            if (!OptionalDigits(req.SsoAccountNo, 10)) errors["ssoAccountNo"] = [L.T("เลขที่บัญชีนายจ้างต้องเป็นตัวเลข 10 หลัก", "Employer account no. must be 10 digits")];
            if (!OptionalDigits(req.TaxBranchNo, 6, required: true)) errors["taxBranchNo"] = [L.T("สาขาต้องเป็นตัวเลข 6 หลัก (สำนักงานใหญ่ 000000)", "Branch no. must be 6 digits (head office 000000)")];
            if (!OptionalDigits(req.SsoBranchNo, 6, required: true)) errors["ssoBranchNo"] = [L.T("สาขาต้องเป็นตัวเลข 6 หลัก (สำนักงานใหญ่ 000000)", "Branch no. must be 6 digits (head office 000000)")];
            if (errors.Count > 0) return Results.ValidationProblem(errors);

            var shop = await db.Tenants.SingleOrDefaultAsync(t => t.Id == tenant.TenantId, ct);
            if (shop is null) return Results.NotFound();
            shop.Name = req.Name.Trim();
            shop.LegalName = Blank(req.LegalName);
            shop.Address = Blank(req.Address);
            shop.TaxId = Blank(req.TaxId);
            shop.TaxBranchNo = req.TaxBranchNo.Trim();
            shop.SsoAccountNo = Blank(req.SsoAccountNo);
            shop.SsoBranchNo = req.SsoBranchNo.Trim();
            shop.RdUserId = Blank(req.RdUserId);
            await db.SaveChangesAsync(ct);
            return Results.Ok(ToDto(shop));
        }).RequireAuthorization(Policies.Owner);

        api.MapGet("/me", async (ClaimsPrincipal principal, JangnaDbContext db, CancellationToken ct) =>
        {
            var userId = principal.UserId();
            var me = await db.Memberships
                .Where(m => m.UserId == userId)
                .Join(db.Tenants, m => m.TenantId, t => t.Id, (m, t) => new { m, t })
                .Select(x => new MeResponse(x.m.UserId, x.m.User!.Email, x.m.User.DisplayName, x.t.Id, x.t.Name, x.m.Role.ToString()))
                .SingleOrDefaultAsync(ct);
            return me is null ? Results.NotFound() : Results.Ok(me);
        });

        var branches = api.MapGroup("/branches");

        branches.MapGet("/", async (JangnaDbContext db, CancellationToken ct) =>
            await db.Branches.OrderBy(b => b.Name).Select(b => ToDto(b)).ToListAsync(ct));

        branches.MapPost("/", async (BranchRequest req, JangnaDbContext db, CancellationToken ct) =>
        {
            if (Validate(req) is { } invalid) return invalid;

            var branch = new Branch { Name = req.Name.Trim(), ProvinceCode = req.ProvinceCode };
            Apply(branch, req);
            db.Branches.Add(branch);
            await db.SaveChangesAsync(ct);
            return Results.Created($"/api/branches/{branch.Id}", ToDto(branch));
        }).RequireAuthorization(Policies.Owner);

        branches.MapPut("/{id:guid}", async (Guid id, BranchRequest req, JangnaDbContext db, CancellationToken ct) =>
        {
            if (Validate(req) is { } invalid) return invalid;

            var branch = await db.Branches.FindAsync([id], ct);
            if (branch is null) return Results.NotFound();
            Apply(branch, req);
            await db.SaveChangesAsync(ct);
            return Results.Ok(ToDto(branch));
        }).RequireAuthorization(Policies.Owner);

        return api;
    }

    private static IResult? Validate(BranchRequest req)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(req.Name)) errors["name"] = [L.T("กรุณากรอกชื่อสาขา", "Branch name is required")];
        if (!System.Text.RegularExpressions.Regex.IsMatch(req.ProvinceCode ?? "", @"^TH-\d{2}$"))
            errors["provinceCode"] = [L.T("รหัสจังหวัดต้องเป็น ISO 3166-2:TH เช่น TH-10", "Province code must be ISO 3166-2:TH, e.g. TH-10")];
        if (req.GeoLat is not null != req.GeoLng is not null) errors["geo"] = [L.T("ต้องระบุทั้ง lat และ lng", "Both lat and lng are required")];
        if (req.GeoRadiusMeters is < 20 or > 5000) errors["geoRadiusMeters"] = [L.T("รัศมี 20–5000 เมตร", "Radius must be 20–5000 metres")];
        return errors.Count > 0 ? Results.ValidationProblem(errors) : null;
    }

    private static void Apply(Branch branch, BranchRequest req)
    {
        branch.Name = req.Name.Trim();
        branch.ProvinceCode = req.ProvinceCode;
        branch.AreaCode = string.IsNullOrWhiteSpace(req.AreaCode) ? null : req.AreaCode.Trim();
        branch.GeoLat = req.GeoLat;
        branch.GeoLng = req.GeoLng;
        if (req.GeoRadiusMeters is { } radius) branch.GeoRadiusMeters = radius;
    }

    private static ShopDto ToDto(Tenant t) =>
        new(t.Name, t.LegalName, t.Address, t.TaxId, t.TaxBranchNo, t.SsoAccountNo, t.SsoBranchNo, t.RdUserId);

    private static string? Blank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static bool OptionalDigits(string? value, int length, bool required = false) =>
        string.IsNullOrWhiteSpace(value) ? !required : value.Trim().Length == length && value.Trim().All(char.IsAsciiDigit);

    private static BranchDto ToDto(Branch b) =>
        new(b.Id, b.Name, b.ProvinceCode, b.AreaCode, b.GeoLat, b.GeoLng, b.GeoRadiusMeters);
}
