using System.Text.Json.Serialization;
using Jangna.Api.Auth;
using Jangna.Api.Endpoints;
using Jangna.Api.Line;
using Jangna.Api.Localization;
using Jangna.Core.Entities;
using Jangna.Core.Tenancy;
using Jangna.Infrastructure;
using Jangna.Infrastructure.Persistence;
using Jangna.Infrastructure.Seed;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;

builder.Services.AddOpenApi();
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddProblemDetails(o =>
{
    // dev เท่านั้น: แนบ exception ใน 500 เพื่อ debug ง่าย
    if (builder.Environment.IsDevelopment())
        o.CustomizeProblemDetails = c =>
        {
            if (c.HttpContext.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>()?.Error is { } error)
                c.ProblemDetails.Detail = error.ToString();
        };
});
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<Jangna.Api.PayRuns.PayRunService>();
builder.Services.AddScoped<Jangna.Api.Exports.ExportService>();

// Persistence + tenancy
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ITenantContext, HttpTenantContext>();
builder.Services.AddJangnaPersistence(config.GetConnectionString("Default")
                                      ?? throw new InvalidOperationException("ต้องตั้ง ConnectionStrings:Default"));

// Auth
var jwt = config.GetSection(JwtOptions.Section).Get<JwtOptions>() ?? new JwtOptions();
if (jwt.SigningKey.Length < 32) throw new InvalidOperationException("Jwt:SigningKey ต้องยาวอย่างน้อย 32 ตัวอักษร");
builder.Services.AddSingleton(jwt);
builder.Services.AddSingleton<TokenService>();
builder.Services.AddSingleton<IPasswordHasher<User>, PasswordHasher<User>>();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.MapInboundClaims = false;
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = jwt.Key(),
            NameClaimType = "name",
            RoleClaimType = JangnaClaims.Role,
        };
    });

builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser().RequireClaim(JangnaClaims.TenantId).Build())
    .AddPolicy(Policies.Owner, p => p.RequireRole(nameof(Role.Owner)))
    .AddPolicy(Policies.Manager, p => p.RequireRole(nameof(Role.Owner), nameof(Role.Manager)));

// LINE
var line = config.GetSection(LineOptions.Section).Get<LineOptions>() ?? new LineOptions();
builder.Services.AddSingleton(line);
if (builder.Environment.IsDevelopment() && string.IsNullOrEmpty(line.LoginChannelId))
    builder.Services.AddSingleton<ILineIdTokenVerifier, DevLineIdTokenVerifier>();
else
    builder.Services.AddHttpClient<ILineIdTokenVerifier, LineIdTokenVerifier>();

builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .WithOrigins(config["Frontend:Origin"] ?? "http://localhost:3000")
    .AllowAnyHeader()
    .AllowAnyMethod()
    .WithExposedHeaders("Content-Disposition"))); // ชื่อไฟล์ตอนดาวน์โหลด

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi().AllowAnonymous();
}

if (config.GetValue<bool>("Database:MigrateOnStartup"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<JangnaDbContext>();
    await db.Database.MigrateAsync();
    await LegalDataSeeder.SeedAsync(db, Path.Combine(AppContext.BaseDirectory, "Seed", "minimum-wages.draft.json"));
}

app.UseRequestLanguage(); // Accept-Language: en → ข้อความ error ภาษาอังกฤษ
app.UseExceptionHandler();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok" })).AllowAnonymous();

app.MapGroup("/api")
    .MapAuthEndpoints()
    .MapOrgEndpoints()
    .MapEmployeeEndpoints()
    .MapLiffEndpoints()
    .MapLegalEndpoints()
    .MapWorkEndpoints()
    .MapPayRunEndpoints()
    .MapExportEndpoints()
    .MapShiftEndpoints();

app.Run();

public partial class Program;
