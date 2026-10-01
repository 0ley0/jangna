using Jangna.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Jangna.Infrastructure;

public static class DependencyInjection
{
    /// <summary>
    /// connectionString = pooled (Neon `-pooler` host) สำหรับ query ปกติ
    /// migrations ใช้ direct connection ผ่าน DesignTimeDbContextFactory
    /// </summary>
    public static IServiceCollection AddJangnaPersistence(this IServiceCollection services, string connectionString) =>
        services.AddDbContext<JangnaDbContext>(o => o
            .UseNpgsql(connectionString)
            .UseSnakeCaseNamingConvention());
}
