using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jangna.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFilingInfoAndShifts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "address",
                table: "tenants",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "legal_name",
                table: "tenants",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "rd_user_id",
                table: "tenants",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "sso_account_no",
                table: "tenants",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "sso_branch_no",
                table: "tenants",
                type: "character varying(6)",
                maxLength: 6,
                nullable: false,
                defaultValue: "000000");

            migrationBuilder.AddColumn<string>(
                name: "tax_branch_no",
                table: "tenants",
                type: "character varying(6)",
                maxLength: 6,
                nullable: false,
                defaultValue: "000000");

            migrationBuilder.AddColumn<string>(
                name: "tax_id",
                table: "tenants",
                type: "character varying(13)",
                maxLength: 13,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "pay_date",
                table: "pay_runs",
                type: "date",
                nullable: false,
                defaultValue: new DateOnly(1, 1, 1));

            // รอบเดิมยังไม่มีวันจ่าย → ถือว่าจ่ายวันสิ้นรอบ
            migrationBuilder.Sql("UPDATE pay_runs SET pay_date = period_end;");

            // warnings เดิมเป็น ["ข้อความไทย"] → [{"th": ..., "en": ...}] (ไม่มีคำแปลเดิม ใช้ไทยทั้งสองช่อง)
            migrationBuilder.Sql("""
                UPDATE pay_run_items
                SET warnings = COALESCE((SELECT jsonb_agg(jsonb_build_object('th', w, 'en', w))
                                         FROM jsonb_array_elements_text(warnings) AS w), '[]'::jsonb)
                WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(warnings) AS e WHERE jsonb_typeof(e) = 'string');
                """);

            migrationBuilder.AddColumn<string>(
                name: "address_line",
                table: "employees",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "district",
                table: "employees",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "national_id",
                table: "employees",
                type: "character varying(13)",
                maxLength: 13,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "postal_code",
                table: "employees",
                type: "character varying(5)",
                maxLength: 5,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "province",
                table: "employees",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "subdistrict",
                table: "employees",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "title",
                table: "employees",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "shift_templates",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    start_time = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    end_time = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    break_minutes = table.Column<int>(type: "integer", nullable: false),
                    color = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    archived = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_shift_templates", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "shifts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    employee_id = table.Column<Guid>(type: "uuid", nullable: false),
                    date = table.Column<DateOnly>(type: "date", nullable: false),
                    shift_template_id = table.Column<Guid>(type: "uuid", nullable: true),
                    start_time = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    end_time = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    break_minutes = table.Column<int>(type: "integer", nullable: false),
                    note = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_shifts", x => x.id);
                    table.ForeignKey(
                        name: "fk_shifts_employees_employee_id",
                        column: x => x.employee_id,
                        principalTable: "employees",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_shifts_shift_templates_shift_template_id",
                        column: x => x.shift_template_id,
                        principalTable: "shift_templates",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "ix_shifts_employee_id",
                table: "shifts",
                column: "employee_id");

            migrationBuilder.CreateIndex(
                name: "ix_shifts_shift_template_id",
                table: "shifts",
                column: "shift_template_id");

            migrationBuilder.CreateIndex(
                name: "ix_shifts_tenant_id_date",
                table: "shifts",
                columns: new[] { "tenant_id", "date" });

            migrationBuilder.CreateIndex(
                name: "ix_shifts_tenant_id_employee_id_date",
                table: "shifts",
                columns: new[] { "tenant_id", "employee_id", "date" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE pay_run_items
                SET warnings = COALESCE((SELECT jsonb_agg(e->>'th') FROM jsonb_array_elements(warnings) AS e), '[]'::jsonb);
                """);

            migrationBuilder.DropTable(
                name: "shifts");

            migrationBuilder.DropTable(
                name: "shift_templates");

            migrationBuilder.DropColumn(
                name: "address",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "legal_name",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "rd_user_id",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "sso_account_no",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "sso_branch_no",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "tax_branch_no",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "tax_id",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "pay_date",
                table: "pay_runs");

            migrationBuilder.DropColumn(
                name: "address_line",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "district",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "national_id",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "postal_code",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "province",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "subdistrict",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "title",
                table: "employees");
        }
    }
}
