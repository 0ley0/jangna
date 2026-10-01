using System.Security.Claims;
using Jangna.Api.Auth;
using Jangna.Core.Entities;
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

    public static RouteGroupBuilder MapOrgEndpoints(this RouteGroupBuilder api)
    {
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
        if (string.IsNullOrWhiteSpace(req.Name)) errors["name"] = ["กรุณากรอกชื่อสาขา"];
        if (!System.Text.RegularExpressions.Regex.IsMatch(req.ProvinceCode ?? "", @"^TH-\d{2}$"))
            errors["provinceCode"] = ["รหัสจังหวัดต้องเป็น ISO 3166-2:TH เช่น TH-10"];
        if (req.GeoLat is not null != req.GeoLng is not null) errors["geo"] = ["ต้องระบุทั้ง lat และ lng"];
        if (req.GeoRadiusMeters is < 20 or > 5000) errors["geoRadiusMeters"] = ["รัศมี 20–5000 เมตร"];
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

    private static BranchDto ToDto(Branch b) =>
        new(b.Id, b.Name, b.ProvinceCode, b.AreaCode, b.GeoLat, b.GeoLng, b.GeoRadiusMeters);
}
