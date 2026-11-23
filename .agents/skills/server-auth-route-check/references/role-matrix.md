# Ajou FoodMap Server Role & Endpoint Matrix

## 1. Access Control Expectations
| Method & Path | Access Level | Anonymous | Signed-in User | Admin | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET /health` | Public | `200` | `200` | `200` | `{ status: "ok" }` |
| `GET /api/auth/providers` | Public | `200` | `200` | `200` | `Cache-Control: no-store`, `{ data: AuthProviders }`. Provider lookup failures return `503`. |
| `GET /api/auth/me` | Authenticated | `401` | `200` | `200` | Verified via `db.auth.getUser(token)` + active `profiles` row |
| `GET /api/users/profile` | Authenticated | `401` | `200` | `200` | Own active profile |
| `PUT /api/users/profile` | Authenticated | `401` | `200` | `200` | Updates own `name`/`avatar` only |
| `DELETE /api/users/account` | Authenticated | `401` | `200` | `200` | `{ success: true, message }`. `409` on `LAST_ADMIN`. |
| `GET /api/users/all` | Admin | `401` | `403` | `200` | Admin-only user directory |
| `PUT /api/users/:userId/type` | Admin | `401` | `403` | `200` | Calls `set_foodmap_user_type` (`409` on `LAST_ADMIN`/`INACTIVE_USER`) |
| `GET /api/restaurants` | Public | `200` | `200` | `200` | Public restaurant list |
| `GET /api/restaurants/popular` | Public | `200` | `200` | `200` | Popular restaurants |
| `GET /api/restaurants/:id` | Public | `200` | `200` | `200` | Single restaurant detail |
| `POST /api/restaurants` | Admin | `401` | `403` | `201` | Admin creation |
| `PUT /api/restaurants/:id` | Admin | `401` | `403` | `200` | Admin update |
| `DELETE /api/restaurants/:id` | Admin | `401` | `403` | `204` | Empty body on `204` |
| `POST /api/submissions` | Authenticated | `401` | `201` | `201` | Uses `req.auth` for submitter identity |
| `GET /api/submissions` | Admin | `401` | `403` | `200` | Optional `status` filter |
| `GET /api/submissions/:id` | Admin | `401` | `403` | `200` | Admin inspection |
| `POST /api/submissions/:id/approve` | Admin | `401` | `403` | `200` | Transactional `approve_foodmap_submission` RPC |
| `PUT /api/submissions/:id` | Admin | `401` | `403` | `200` | Reject submission |
| `DELETE /api/submissions/:id` | Admin | `401` | `403` | `204` | Empty body on `204` |

## 2. Middleware & Error Contract
- `isAuthenticated` rejects missing/invalid Bearer JWT (`401`), missing profile (`403`), inactive profile (`403`), or Auth server failure (`503`).
- `requireAdmin` always runs **after** `isAuthenticated` and returns `403` when `req.auth?.userType !== "admin"`.
- `src/app.ts` keeps `credentials: false`, `allowedHeaders: ["Content-Type", "Authorization"]`, `express.json({ limit: "100kb" })`, and registers `notFound` then `errorHandler` last.
- `errorHandler` emits `{ success: false, message, error: { message } }`. Unmatched routes use `notFound` and return `404` with `{ error: { message } }`.
