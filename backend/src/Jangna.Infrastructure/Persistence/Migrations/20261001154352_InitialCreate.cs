using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jangna.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "branches",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    province_code = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    area_code = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    geo_lat = table.Column<double>(type: "double precision", nullable: true),
                    geo_lng = table.Column<double>(type: "double precision", nullable: true),
                    geo_radius_meters = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_branches", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "legal_rule_sets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    effective_from = table.Column<DateOnly>(type: "date", nullable: false),
                    payload = table.Column<string>(type: "jsonb", nullable: false),
                    source = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_legal_rule_sets", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "minimum_wages",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    province_code = table.Column<string>(type: "text", nullable: false),
                    area_code = table.Column<string>(type: "text", nullable: true),
                    daily_rate = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    effective_from = table.Column<DateOnly>(type: "date", nullable: false),
                    verified = table.Column<bool>(type: "boolean", nullable: false),
                    source = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_minimum_wages", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "tenants",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_tenants", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    display_name = table.Column<string>(type: "text", nullable: false),
                    password_hash = table.Column<string>(type: "text", nullable: false),
                    line_user_id = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_users", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "employees",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    first_name = table.Column<string>(type: "text", nullable: false),
                    last_name = table.Column<string>(type: "text", nullable: false),
                    nickname = table.Column<string>(type: "text", nullable: true),
                    phone = table.Column<string>(type: "text", nullable: true),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: true),
                    pay_type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    base_rate = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    worker_type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    language = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false),
                    line_user_id = table.Column<string>(type: "text", nullable: true),
                    line_linked_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_employees", x => x.id);
                    table.ForeignKey(
                        name: "fk_employees_branches_branch_id",
                        column: x => x.branch_id,
                        principalTable: "branches",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "memberships",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    role = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_memberships", x => x.id);
                    table.ForeignKey(
                        name: "fk_memberships_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "employee_invites",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    employee_id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    used_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_employee_invites", x => x.id);
                    table.ForeignKey(
                        name: "fk_employee_invites_employees_employee_id",
                        column: x => x.employee_id,
                        principalTable: "employees",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_employee_invites_code",
                table: "employee_invites",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_employee_invites_employee_id",
                table: "employee_invites",
                column: "employee_id");

            migrationBuilder.CreateIndex(
                name: "ix_employees_branch_id",
                table: "employees",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "ix_employees_tenant_id_line_user_id",
                table: "employees",
                columns: new[] { "tenant_id", "line_user_id" },
                unique: true,
                filter: "line_user_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_legal_rule_sets_effective_from",
                table: "legal_rule_sets",
                column: "effective_from",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_memberships_tenant_id_user_id",
                table: "memberships",
                columns: new[] { "tenant_id", "user_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_memberships_user_id",
                table: "memberships",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_minimum_wages_province_code_area_code_effective_from",
                table: "minimum_wages",
                columns: new[] { "province_code", "area_code", "effective_from" },
                unique: true)
                .Annotation("Npgsql:NullsDistinct", false);

            migrationBuilder.CreateIndex(
                name: "ix_users_email",
                table: "users",
                column: "email",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "employee_invites");

            migrationBuilder.DropTable(
                name: "legal_rule_sets");

            migrationBuilder.DropTable(
                name: "memberships");

            migrationBuilder.DropTable(
                name: "minimum_wages");

            migrationBuilder.DropTable(
                name: "tenants");

            migrationBuilder.DropTable(
                name: "employees");

            migrationBuilder.DropTable(
                name: "users");

            migrationBuilder.DropTable(
                name: "branches");
        }
    }
}
