using System.Text.Json;
using Jangna.Core.Entities;
using Jangna.Core.Tenancy;
using Jangna.Payroll.Engine.Rules;
using Microsoft.EntityFrameworkCore;

namespace Jangna.Infrastructure.Persistence;

public sealed class JangnaDbContext(DbContextOptions<JangnaDbContext> options, ITenantContext tenant)
    : DbContext(options)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        // เก็บภาษาไทยตามจริง ไม่ escape เป็น \uXXXX (ค่าอยู่ใน jsonb ไม่ได้ถูก render เป็น HTML)
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.Create(System.Text.Unicode.UnicodeRanges.All),
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() },
    };

    /// <summary>ถูกอ้างใน global query filter — EF ประเมินค่าใหม่ทุก query ต่อ context instance</summary>
    public Guid? CurrentTenantId => tenant.TenantId;

    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Membership> Memberships => Set<Membership>();
    public DbSet<Branch> Branches => Set<Branch>();
    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<EmployeeInvite> EmployeeInvites => Set<EmployeeInvite>();
    public DbSet<LegalRuleSet> LegalRuleSets => Set<LegalRuleSet>();
    public DbSet<MinimumWage> MinimumWages => Set<MinimumWage>();
    public DbSet<WorkDay> WorkDays => Set<WorkDay>();
    public DbSet<PieceWorkEntry> PieceWorkEntries => Set<PieceWorkEntry>();
    public DbSet<Advance> Advances => Set<Advance>();
    public DbSet<Holiday> Holidays => Set<Holiday>();
    public DbSet<PayRun> PayRuns => Set<PayRun>();
    public DbSet<PayRunItem> PayRunItems => Set<PayRunItem>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<OpeningBalance> OpeningBalances => Set<OpeningBalance>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>(e =>
        {
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.Email).HasMaxLength(320);
        });

        b.Entity<Membership>(e =>
        {
            e.HasIndex(x => new { x.TenantId, x.UserId }).IsUnique();
            e.Property(x => x.Role).HasConversion<string>().HasMaxLength(20);
        });

        b.Entity<Branch>(e =>
        {
            e.Property(x => x.ProvinceCode).HasMaxLength(8);
            e.Property(x => x.AreaCode).HasMaxLength(16);
        });

        b.Entity<Employee>(e =>
        {
            e.Property(x => x.BaseRate).HasPrecision(12, 2);
            e.Property(x => x.PayType).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.WorkerType).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Language).HasMaxLength(5);
            e.HasIndex(x => new { x.TenantId, x.LineUserId }).IsUnique().HasFilter("line_user_id IS NOT NULL");
        });

        b.Entity<EmployeeInvite>(e =>
        {
            e.HasIndex(x => x.Code).IsUnique();
            e.Property(x => x.Code).HasMaxLength(32);
        });

        b.Entity<LegalRuleSet>(e =>
        {
            e.HasIndex(x => x.EffectiveFrom).IsUnique();
            Json(e.Property(x => x.Payload));
        });

        b.Entity<WorkDay>(e =>
        {
            e.HasIndex(x => new { x.TenantId, x.EmployeeId, x.Date }).IsUnique();
            e.Property(x => x.NormalHours).HasPrecision(5, 2);
            e.Property(x => x.OvertimeHours).HasPrecision(5, 2);
            e.Property(x => x.Kind).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Leave).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Source).HasConversion<string>().HasMaxLength(20);
        });

        b.Entity<PieceWorkEntry>(e =>
        {
            e.HasIndex(x => new { x.TenantId, x.EmployeeId, x.Date });
            e.Property(x => x.Quantity).HasPrecision(12, 2);
            e.Property(x => x.Rate).HasPrecision(12, 4);
            e.Property(x => x.Source).HasConversion<string>().HasMaxLength(20);
        });

        b.Entity<Advance>(e =>
        {
            e.HasIndex(x => new { x.TenantId, x.EmployeeId });
            e.Property(x => x.Amount).HasPrecision(12, 2);
        });

        b.Entity<Holiday>(e => e.HasIndex(x => new { x.TenantId, x.Date }).IsUnique());

        b.Entity<PayRun>(e =>
        {
            e.HasIndex(x => new { x.TenantId, x.PeriodStart });
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            Json(e.Property(x => x.RulesSnapshot));
            e.HasMany(x => x.Items).WithOne().HasForeignKey(x => x.PayRunId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<PayRunItem>(e =>
        {
            e.HasIndex(x => new { x.PayRunId, x.EmployeeId }).IsUnique();
            e.HasIndex(x => new { x.TenantId, x.EmployeeId });
            e.Property(x => x.PayType).HasConversion<string>().HasMaxLength(20);
            foreach (var p in new[] { "Gross", "TaxableIncome", "SocialSecurityWage", "SocialSecurityEmployee", "SocialSecurityEmployer", "WithholdingTax", "AdvanceDeducted", "AdvanceCarriedOver", "Net" })
                e.Property<decimal>(p).HasPrecision(14, 2);
            Json(e.Property(x => x.Lines));
            Json(e.Property(x => x.Warnings));
            Json(e.Property(x => x.Input));
        });

        b.Entity<OpeningBalance>(e =>
        {
            e.HasIndex(x => new { x.TenantId, x.EmployeeId, x.Year }).IsUnique();
            e.Property(x => x.TaxableIncome).HasPrecision(14, 2);
            e.Property(x => x.TaxWithheld).HasPrecision(14, 2);
            e.Property(x => x.SocialSecurity).HasPrecision(14, 2);
        });

        b.Entity<AuditLog>(e =>
        {
            e.HasIndex(x => new { x.TenantId, x.EntityType, x.EntityId });
            e.Property(x => x.Changes).HasColumnType("jsonb");
        });

        b.Entity<MinimumWage>(e =>
        {
            e.Property(x => x.DailyRate).HasPrecision(10, 2);
            e.HasIndex(x => new { x.ProvinceCode, x.AreaCode, x.EffectiveFrom }).IsUnique().AreNullsDistinct(false);
        });

        foreach (var type in b.Model.GetEntityTypes().Where(t => typeof(ITenantOwned).IsAssignableFrom(t.ClrType)))
        {
            typeof(JangnaDbContext)
                .GetMethod(nameof(ApplyTenantFilter), System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!
                .MakeGenericMethod(type.ClrType)
                .Invoke(this, [b]);
        }
    }

    private void ApplyTenantFilter<T>(ModelBuilder b) where T : class, ITenantOwned =>
        b.Entity<T>().HasQueryFilter(e => e.TenantId == CurrentTenantId);

    /// <summary>เก็บ object เป็น jsonb — เทียบการเปลี่ยนแปลงด้วย JSON (ใช้ได้กับ list/record)</summary>
    private static void Json<T>(Microsoft.EntityFrameworkCore.Metadata.Builders.PropertyBuilder<T> property) =>
        property
            .HasColumnType("jsonb")
            .HasConversion(
                v => JsonSerializer.Serialize(v, JsonOptions),
                v => JsonSerializer.Deserialize<T>(v, JsonOptions)!,
                new Microsoft.EntityFrameworkCore.ChangeTracking.ValueComparer<T>(
                    (a, c) => JsonSerializer.Serialize(a, JsonOptions) == JsonSerializer.Serialize(c, JsonOptions),
                    v => JsonSerializer.Serialize(v, JsonOptions).GetHashCode(),
                    v => JsonSerializer.Deserialize<T>(JsonSerializer.Serialize(v, JsonOptions), JsonOptions)!));

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        StampTenant();
        WriteAudit();
        return base.SaveChangesAsync(cancellationToken);
    }

    public override int SaveChanges()
    {
        StampTenant();
        WriteAudit();
        return base.SaveChanges();
    }

    /// <summary>บันทึกทุกการเพิ่ม/แก้/ลบของ entity ที่เป็น IAudited (ใคร แก้อะไร เมื่อไหร่)</summary>
    private void WriteAudit()
    {
        var entries = ChangeTracker.Entries()
            .Where(e => e.Entity is IAudited && e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
            .ToList();

        foreach (var entry in entries)
        {
            object changes = entry.State switch
            {
                EntityState.Modified => entry.Properties
                    .Where(p => p.IsModified && !Equals(p.OriginalValue, p.CurrentValue))
                    .ToDictionary(p => p.Metadata.Name, p => new[] { p.OriginalValue, p.CurrentValue }),
                EntityState.Deleted => entry.Properties.ToDictionary(p => p.Metadata.Name, p => p.OriginalValue),
                _ => entry.Properties.ToDictionary(p => p.Metadata.Name, p => p.CurrentValue),
            };
            if (changes is System.Collections.ICollection { Count: 0 }) continue;

            var entity = (ITenantOwned)entry.Entity;
            AuditLogs.Add(new AuditLog
            {
                TenantId = entity.TenantId,
                UserId = tenant.UserId,
                Action = entry.State.ToString(),
                EntityType = entry.Metadata.ClrType.Name,
                EntityId = ((Entity)entry.Entity).Id,
                Changes = JsonSerializer.Serialize(changes, JsonOptions),
            });
        }
    }

    /// <summary>เติม TenantId ให้ข้อมูลใหม่ และกันไม่ให้เขียนข้าม tenant</summary>
    private void StampTenant()
    {
        foreach (var entry in ChangeTracker.Entries<ITenantOwned>())
        {
            if (entry.State == EntityState.Added && entry.Entity.TenantId == Guid.Empty)
            {
                entry.Entity.TenantId = CurrentTenantId
                    ?? throw new InvalidOperationException($"บันทึก {entry.Entity.GetType().Name} ไม่ได้: ไม่มี tenant ใน context");
            }

            if (entry.State is EntityState.Added or EntityState.Modified or EntityState.Deleted
                && CurrentTenantId is { } current
                && entry.Entity.TenantId != current)
            {
                throw new InvalidOperationException($"ห้ามเขียน {entry.Entity.GetType().Name} ข้าม tenant");
            }
        }
    }
}
