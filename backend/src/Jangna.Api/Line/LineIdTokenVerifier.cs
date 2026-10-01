using System.Text.Json.Serialization;

namespace Jangna.Api.Line;

public sealed class LineOptions
{
    public const string Section = "Line";

    /// <summary>Channel ID ของ LINE Login channel ที่ผูกกับ LIFF app</summary>
    public string LoginChannelId { get; set; } = "";

    public string LiffId { get; set; } = "";
}

public sealed record LineProfile(string UserId, string? DisplayName, string? PictureUrl);

public interface ILineIdTokenVerifier
{
    /// <summary>คืน null ถ้า token ไม่ถูกต้อง/หมดอายุ</summary>
    Task<LineProfile?> VerifyAsync(string idToken, CancellationToken ct);
}

/// <summary>ตรวจ ID token จาก liff.getIDToken() กับ LINE โดยตรง</summary>
public sealed class LineIdTokenVerifier(HttpClient http, LineOptions options) : ILineIdTokenVerifier
{
    public async Task<LineProfile?> VerifyAsync(string idToken, CancellationToken ct)
    {
        using var response = await http.PostAsync(
            "https://api.line.me/oauth2/v2.1/verify",
            new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["id_token"] = idToken,
                ["client_id"] = options.LoginChannelId,
            }),
            ct);

        if (!response.IsSuccessStatusCode) return null;

        var body = await response.Content.ReadFromJsonAsync<VerifyResponse>(ct);
        return body?.Sub is { Length: > 0 } sub ? new LineProfile(sub, body.Name, body.Picture) : null;
    }

    private sealed record VerifyResponse(
        [property: JsonPropertyName("sub")] string? Sub,
        [property: JsonPropertyName("name")] string? Name,
        [property: JsonPropertyName("picture")] string? Picture);
}

/// <summary>
/// ใช้ตอน dev เมื่อยังไม่ได้ตั้ง LINE channel: รับ token รูปแบบ "dev:{userId}:{ชื่อ}"
/// ลงทะเบียนเฉพาะ Development เท่านั้น
/// </summary>
public sealed class DevLineIdTokenVerifier : ILineIdTokenVerifier
{
    public Task<LineProfile?> VerifyAsync(string idToken, CancellationToken ct)
    {
        var parts = idToken.Split(':', 3);
        return Task.FromResult(parts is ["dev", { Length: > 0 } id, ..]
            ? new LineProfile($"Udev{id}", parts.ElementAtOrDefault(2), null)
            : null);
    }
}
