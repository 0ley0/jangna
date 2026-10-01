using System.Net.Http.Headers;
using System.Net.Http.Json;
using Jangna.Api.Endpoints;
using Jangna.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Jangna.Tests.Api;

/// <summary>API จริงทั้ง pipeline แต่ใช้ EF InMemory และ DevLineIdTokenVerifier (environment = Development)</summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    private readonly string _dbName = Guid.NewGuid().ToString();

    static ApiFactory()
    {
        // ค่าพวกนี้ถูกอ่านตอน CreateBuilder จึงต้องตั้งผ่าน env ก่อนสร้าง host
        Environment.SetEnvironmentVariable("Database__MigrateOnStartup", "false");
        Environment.SetEnvironmentVariable("Line__LoginChannelId", "");
    }

    protected override void ConfigureWebHost(Microsoft.AspNetCore.Hosting.IWebHostBuilder builder) =>
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<JangnaDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<JangnaDbContext>>();
            services.AddDbContext<JangnaDbContext>(o => o.UseInMemoryDatabase(_dbName));
        });

    /// <summary>MigrateOnStartup ถูกปิด → seed ข้อมูลกฎหมายเองหลังสร้าง host</summary>
    protected override Microsoft.Extensions.Hosting.IHost CreateHost(Microsoft.Extensions.Hosting.IHostBuilder builder)
    {
        var host = base.CreateHost(builder);
        using var scope = host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<JangnaDbContext>();
        Jangna.Infrastructure.Seed.LegalDataSeeder
            .SeedAsync(db, Path.Combine(AppContext.BaseDirectory, "Seed", "minimum-wages.draft.json"))
            .GetAwaiter().GetResult();
        return host;
    }

    public async Task<HttpClient> RegisterShopAsync(string shop, string email)
    {
        var client = CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/register",
            new AuthEndpoints.RegisterRequest(shop, email, "password123", "เจ้าของ"));
        response.EnsureSuccessStatusCode();
        var auth = await response.Content.ReadFromJsonAsync<AuthEndpoints.AuthResponse>(Json.Options);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.AccessToken);
        return client;
    }
}

public static class Json
{
    public static readonly System.Text.Json.JsonSerializerOptions Options = new(System.Text.Json.JsonSerializerDefaults.Web)
    {
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() },
    };
}
