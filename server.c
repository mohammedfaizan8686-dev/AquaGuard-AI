
#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <winsock2.h>
#include <ws2tcpip.h>
typedef SOCKET socket_t;
#define CLOSESOCK closesocket
#else
#include <sys/types.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <strings.h>
typedef int socket_t;
#define INVALID_SOCKET (-1)
#define SOCKET_ERROR (-1)
#define CLOSESOCK close
#endif

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

#define PORT 8080
#define REQ_SIZE 32768

static const char *get_mime(const char *path) {
    if (strstr(path, ".css"))
        return "text/css; charset=utf-8";
    if (strstr(path, ".js"))
        return "application/javascript; charset=utf-8";
    if (strstr(path, ".html"))
        return "text/html; charset=utf-8";
    if (strstr(path, ".json"))
        return "application/json; charset=utf-8";
    return "text/plain; charset=utf-8";
}

static void send_response(socket_t client, const char *status,
                          const char *type, const char *body) {
    char header[512];
    size_t len = strlen(body);

    snprintf(header, sizeof(header),
        "HTTP/1.1 %s\r\n"
        "Content-Type: %s\r\n"
        "Content-Length: %lu\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "Connection: close\r\n"
        "X-Content-Type-Options: nosniff\r\n\r\n",
        status, type, (unsigned long)len);

    send(client, header, (int)strlen(header), 0);
    if (len > 0)
        send(client, body, (int)len, 0);
}

static int read_number(const char *body, const char *key,
                       double *out) {
    char pattern[80];
    snprintf(pattern, sizeof(pattern), "\"%s\"", key);

    const char *p = strstr(body, pattern);
    if (!p) return 0;

    p = strchr(p, ':');
    if (!p) return 0;

    p++;
    while (*p && isspace((unsigned char)*p)) p++;

    char *end = NULL;
    double value = strtod(p, &end);

    if (end == p) return 0;

    *out = value;
    return 1;
}

static int read_string(const char *body, const char *key,
                       char *out, size_t cap) {
    char pattern[80];
    snprintf(pattern, sizeof(pattern), "\"%s\"", key);

    const char *p = strstr(body, pattern);
    if (!p) return 0;

    p = strchr(p, ':');
    if (!p) return 0;

    p++;
    while (*p && isspace((unsigned char)*p)) p++;

    if (*p != '"') return 0;
    p++;

    size_t i = 0;

    while (*p && *p != '"' && i + 1 < cap) {
        if (*p == '\\' && p[1]) p++;
        out[i++] = *p++;
    }

    out[i] = '\0';
    return 1;
}

static void json_escape(const char *src, char *dst, size_t cap) {
    size_t j = 0;

    for (size_t i = 0; src[i] && j + 2 < cap; i++) {
        if (src[i] == '"' || src[i] == '\\')
            dst[j++] = '\\';

        if ((unsigned char)src[i] >= 32)
            dst[j++] = src[i];
    }

    dst[j] = '\0';
}

static void analyze(const char *body, char *out, size_t cap) {
    double ph, turbidity, oxygen, complaints;
    char area[100] = "Unspecified area";
    char area_safe[200];
    char reasons[512] = "";

    int anomalies = 0;
    int first = 1;
    double score = 0.0;

    if (!read_number(body, "ph", &ph) ||
        !read_number(body, "turbidity", &turbidity) ||
        !read_number(body, "oxygen", &oxygen) ||
        !read_number(body, "complaints", &complaints)) {

        snprintf(out, cap,
            "{\"error\":\"Provide numeric pH, turbidity, oxygen and complaints values.\"}");
        return;
    }

    read_string(body, "area", area, sizeof(area));

    if (ph < 0 || ph > 14 ||
        turbidity < 0 || turbidity > 1000 ||
        oxygen < 0 || oxygen > 50 ||
        complaints < 0 || complaints > 100000 ||
        complaints != (int)complaints) {

        snprintf(out, cap,
            "{\"error\":\"Input outside demo range. pH: 0-14, turbidity: 0-1000, oxygen: 0-50, complaints: integer 0-100000.\"}");
        return;
    }

    if (ph < 6.5 || ph > 8.5) {
        score += 25;
        anomalies++;
        snprintf(reasons + strlen(reasons),
            sizeof(reasons) - strlen(reasons),
            "%s\"pH is outside the example range 6.5-8.5\"",
            first ? "" : ",");
        first = 0;
    }

    if (turbidity > 5.0) {
        score += 20;
        anomalies++;
        snprintf(reasons + strlen(reasons),
            sizeof(reasons) - strlen(reasons),
            "%s\"Turbidity exceeds the example threshold of 5 NTU\"",
            first ? "" : ",");
        first = 0;
    }

    if (oxygen < 5.0) {
        score += 15;
        anomalies++;
        snprintf(reasons + strlen(reasons),
            sizeof(reasons) - strlen(reasons),
            "%s\"Dissolved oxygen is below the example threshold of 5 mg/L\"",
            first ? "" : ",");
        first = 0;
    }

    score += (complaints / 10.0) * 40.0;

    if (score > 100) score = 100;

    if (complaints >= 5) {
        snprintf(reasons + strlen(reasons),
            sizeof(reasons) - strlen(reasons),
            "%s\"Complaint count is elevated (5 or more reports)\"",
            first ? "" : ",");
        first = 0;
    }

    if (first)
        snprintf(reasons, sizeof(reasons),
            "\"No configured anomaly rule was triggered\"");

    const char *priority =
        score >= 75 ? "Critical" :
        score >= 50 ? "High" :
        score >= 25 ? "Moderate" : "Low";

    const char *action =
        score >= 75 ?
        "Urgent inspection and confirmatory laboratory testing are recommended." :
        score >= 50 ?
        "Prioritize an inspection and verify the readings." :
        score >= 25 ?
        "Schedule a follow-up check and review the readings." :
        "Continue routine monitoring; this score does not prove the water is safe.";

    json_escape(area, area_safe, sizeof(area_safe));

    snprintf(out, cap,
        "{\"area\":\"%s\","
        "\"score\":%.0f,"
        "\"priority\":\"%s\","
        "\"anomalies\":%d,"
        "\"reasons\":[%s],"
        "\"action\":\"%s\","
        "\"disclaimer\":\"Educational heuristic score using demo thresholds; not a drinking-water safety determination.\"}",
        area_safe, score, priority, anomalies, reasons, action);
}

static int send_file(socket_t client, const char *relative) {
    char path[512];

    snprintf(path, sizeof(path), "public/%s", relative);

    FILE *fp = fopen(path, "rb");
    if (!fp) return 0;

    fseek(fp, 0, SEEK_END);
    long size = ftell(fp);
    fseek(fp, 0, SEEK_SET);

    if (size < 0 || size > 2000000) {
        fclose(fp);
        return 0;
    }

    char *data = (char *)malloc((size_t)size + 1);

    if (!data) {
        fclose(fp);
        return 0;
    }

    size_t got = fread(data, 1, (size_t)size, fp);
    fclose(fp);
    data[got] = '\0';

    char header[512];

    snprintf(header, sizeof(header),
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: %s\r\n"
        "Content-Length: %lu\r\n"
        "Connection: close\r\n"
        "X-Content-Type-Options: nosniff\r\n\r\n",
        get_mime(path), (unsigned long)got);

    send(client, header, (int)strlen(header), 0);

    if (got > 0)
        send(client, data, (int)got, 0);

    free(data);
    return 1;
}

static void handle_client(socket_t client) {
    char req[REQ_SIZE];
    int total = 0;
    int n;

    while (total < (int)sizeof(req) - 1) {
        n = recv(client, req + total,
            (int)sizeof(req) - total - 1, 0);

        if (n <= 0) break;

        total += n;
        req[total] = '\0';

        if (strstr(req, "\r\n\r\n")) {
            char *cl = strstr(req, "Content-Length:");
            int expected = 0;

            if (cl) expected = atoi(cl + 15);

            char *body = strstr(req, "\r\n\r\n") + 4;
            int have = total - (int)(body - req);

            if (have >= expected) break;
        }
    }

    req[total] = '\0';

    if (strncmp(req, "OPTIONS ", 8) == 0) {
        send_response(client, "204 No Content", "text/plain", "");

    } else if (strncmp(req, "POST /analyze ", 13) == 0) {
        char *body = strstr(req, "\r\n\r\n");
        char result[4096];

        if (!body) {
            snprintf(result, sizeof(result),
                "{\"error\":\"Malformed request.\"}");
        } else {
            analyze(body + 4, result, sizeof(result));
        }

        send_response(client, "200 OK",
            "application/json; charset=utf-8", result);

    } else if (strncmp(req, "GET / ", 6) == 0 ||
               strncmp(req, "GET /index.html ", 16) == 0) {

        if (!send_file(client, "index.html"))
            send_response(client, "404 Not Found", "text/plain",
                "Missing public/index.html");

    } else if (strncmp(req, "GET /style.css ", 15) == 0) {

        if (!send_file(client, "style.css"))
            send_response(client, "404 Not Found", "text/plain",
                "Missing public/style.css");

    } else if (strncmp(req, "GET /app.js ", 12) == 0) {

        if (!send_file(client, "app.js"))
            send_response(client, "404 Not Found", "text/plain",
                "Missing public/app.js");

    } else if (strncmp(req, "GET /admin.html ", 16) == 0) {

        if (!send_file(client, "admin.html"))
            send_response(client, "404 Not Found", "text/plain",
                "Missing public/admin.html");

    } else if (strncmp(req, "GET /complaints.html ", 20) == 0) {

        if (!send_file(client, "complaints.html"))
            send_response(client, "404 Not Found", "text/plain",
                "Missing public/complaints.html");

    } else {
        send_response(client, "404 Not Found",
            "text/plain", "Not found");
    }
}

int main(void) {
#ifdef _WIN32
    WSADATA wsa;

    if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) {
        fprintf(stderr, "Could not initialize Winsock.\n");
        return 1;
    }
#endif

    socket_t server = socket(AF_INET, SOCK_STREAM, 0);

    if (server == INVALID_SOCKET) {
        fprintf(stderr, "Could not create server socket.\n");
        return 1;
    }

    int opt = 1;

#ifdef _WIN32
    setsockopt(server, SOL_SOCKET, SO_REUSEADDR,
        (const char *)&opt, sizeof(opt));
#else
    setsockopt(server, SOL_SOCKET, SO_REUSEADDR,
        &opt, sizeof(opt));
#endif

    struct sockaddr_in addr;
    memset(&addr, 0, sizeof(addr));

    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    addr.sin_port = htons(PORT);

    if (bind(server, (struct sockaddr *)&addr, sizeof(addr))
            == SOCKET_ERROR ||
        listen(server, 10) == SOCKET_ERROR) {

        fprintf(stderr,
            "Could not bind/listen on port %d. Is it already in use?\n",
            PORT);

        CLOSESOCK(server);

#ifdef _WIN32
        WSACleanup();
#endif
        return 1;
    }

    printf("AquaGuard AI running at http://127.0.0.1:%d\n", PORT);
    printf("Press Ctrl+C to stop.\n");

    for (;;) {
        socket_t client = accept(server, NULL, NULL);

        if (client == INVALID_SOCKET) continue;

        handle_client(client);
        CLOSESOCK(client);
    }

    CLOSESOCK(server);

#ifdef _WIN32
    WSACleanup();
#endif

    return 0;
}
