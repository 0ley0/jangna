using Jangna.Api.Auth;
using Jangna.Api.Exports;

namespace Jangna.Api.Endpoints;

/// <summary>เอกสารนำส่ง (สปส.1-10, ภ.ง.ด.1) และสลิปเงินเดือน — จากรอบจ่ายที่ปิดแล้วเท่านั้น</summary>
public static class ExportEndpoints
{
    public static RouteGroupBuilder MapExportEndpoints(this RouteGroupBuilder api)
    {
        var exports = api.MapGroup("/exports").RequireAuthorization(Policies.Manager);

        exports.MapGet("/summary", (int year, int month, ExportService service, CancellationToken ct) =>
            Handle(async () => Results.Ok(await service.SummaryAsync(year, month, ct))));

        exports.MapGet("/sso", (int year, int month, DateOnly paymentDate, ExportService service, CancellationToken ct) =>
            Handle(async () => File(await service.SsoAsync(year, month, paymentDate, ct))));

        exports.MapGet("/pnd1", (int year, int month, ExportService service, CancellationToken ct) =>
            Handle(async () => File(await service.Pnd1Async(year, month, ct))));

        exports.MapGet("/pnd3", (int year, int month, ExportService service, CancellationToken ct) =>
            Handle(async () => File(await service.Pnd3Async(year, month, ct))));

        exports.MapGet("/year-summary", (int year, ExportService service, CancellationToken ct) =>
            Handle(async () => Results.Ok(await service.YearSummaryAsync(year, ct))));

        exports.MapGet("/pnd1a", (int year, ExportService service, CancellationToken ct) =>
            Handle(async () => File(await service.Pnd1AAsync(year, ct))));

        exports.MapGet("/certificates", (int year, Guid? employeeId, ExportService service, CancellationToken ct) =>
            Handle(async () => File(await service.CertificatesAsync(year, employeeId, ct))));

        api.MapGet("/pay-runs/{id:guid}/payslips", (Guid id, Guid? employeeId, string? lang, ExportService service, CancellationToken ct) =>
                Handle(async () => File(await service.PayslipsAsync(id, employeeId, lang, ct))))
            .RequireAuthorization(Policies.Manager);

        return api;
    }

    private static IResult File(ExportService.FileResult f) => Results.File(f.Content, f.ContentType, f.FileName);

    private static async Task<IResult> Handle(Func<Task<IResult>> action)
    {
        try
        {
            return await action();
        }
        catch (ExportException e)
        {
            return Results.Problem(e.Message, statusCode: e.Status);
        }
    }
}
