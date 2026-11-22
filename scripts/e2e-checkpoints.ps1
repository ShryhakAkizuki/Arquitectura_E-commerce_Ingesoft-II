<#
.SYNOPSIS
    Verificacion end-to-end de los puntos de control CP-1..CP-5 (paso D-6).

.DESCRIPTION
    Ejecuta el guion completo contra una base de datos LIMPIA y asume que el
    backend ya esta corriendo en http://localhost:8080 (perfil postgres o h2).

    Cada paso imprime [OK] / [FALLO] y el script termina con exit code 0 solo
    si TODAS las aserciones pasan.

    Uso:
        # Backend corriendo contra una BD limpia:
        powershell -ExecutionPolicy Bypass -File scripts\e2e-checkpoints.ps1

        # (Opcional) recrea la BD `shop` antes de ejecutar (requiere psql en PATH
        #  y las credenciales del backend):
        powershell -ExecutionPolicy Bypass -File scripts\e2e-checkpoints.ps1 -ResetDb

.NOTES
    Referencia: docs/arquitectura.md (seccion 11.7, puntos de control CP-1..CP-5)
#>
param(
    [string]$Base = 'http://localhost:8080/api',
    [switch]$ResetDb,
    [string]$PgUser = 'postgres',
    [string]$PgPassword = 'admin',
    [string]$PgHost = '127.0.0.1',
    [string]$PgPort = '5432'
)

$ErrorActionPreference = 'Stop'

# --- IDs del seed (V2__seed.sql) -------------------------------------------
$P_LAPTOP   = '00000000-0000-0000-0000-000000000101'
$P_TECLADO  = '00000000-0000-0000-0000-000000000102'
$P_MOUSE    = '00000000-0000-0000-0000-000000000103'
$P_CABLE    = '00000000-0000-0000-0000-000000000105'   # stock bajo (2)

$pass = 0
$fail = 0

function Write-Step([string]$msg) { Write-Host "`n== $msg" -ForegroundColor Cyan }
function Assert-True([bool]$cond, [string]$msg) {
    if ($cond) { $script:pass++; Write-Host "  [OK] $msg" -ForegroundColor Green }
    else       { $script:fail++; Write-Host "  [FALLO] $msg" -ForegroundColor Red }
}
function Assert-Status([int]$status, [int]$expected, [string]$msg) {
    Assert-True ($status -eq $expected) "$msg (esperado $expected, obtenido $status)"
}

function Invoke-Api([string]$Method, [string]$Url, $Body = $null, [string]$Token = $null) {
    $headers = @{}
    if ($Token) { $headers['Authorization'] = "Bearer $Token" }
    try {
        $params = @{ Method = $Method; Uri = $Url; Headers = $headers; UseBasicParsing = $true }
        if ($null -ne $Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
            $params.ContentType = 'application/json'
        }
        $resp = Invoke-WebRequest @params
        return @{ Status = [int]$resp.StatusCode; Body = $resp.Content }
    }
    catch {
        $resp = $_.Exception.Response
        if ($null -ne $resp) {
            $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
            $content = $reader.ReadToEnd()
            return @{ Status = [int]$resp.StatusCode; Body = $content }
        }
        throw
    }
}

function Get-Json([string]$text) { return $text | ConvertFrom-Json }

# ============================================================================
# Opcional: recrear la BD limpia
# ============================================================================
if ($ResetDb) {
    Write-Host "Recreando la base de datos 'shop'..." -ForegroundColor Yellow
    $uri = "postgresql://${PgUser}:${PgPassword}@${PgHost}:${PgPort}/postgres"
    psql $uri -c "DROP DATABASE IF EXISTS shop;" | Out-Null
    psql $uri -c "CREATE DATABASE shop;" | Out-Null
    Write-Host "  BD recreada. REINICIE el backend para que Flyway re-migre, y vuelva a correr este script sin -ResetDb." -ForegroundColor Yellow
    exit 0
}

Write-Host "E2E CP-1..CP-5 contra $Base" -ForegroundColor White

# --- Sesiones demo ----------------------------------------------------------
$loginAdmin = Invoke-Api 'POST' "$Base/auth/login" @{ email = 'admin@demo.com';  password = 'Admin123!' }
Assert-Status $loginAdmin.Status 200 'login admin'
$adminToken = (Get-Json $loginAdmin.Body).token

$loginUser = Invoke-Api 'POST' "$Base/auth/login" @{ email = 'user@demo.com';  password = 'User123!' }
Assert-Status $loginUser.Status 200 'login usuario demo'
$userToken = (Get-Json $loginUser.Body).token

# ============================================================================
# CP-1 : registro -> login -> perfil -> ruta admin denegada
# ============================================================================
Write-Step 'CP-1: registro -> login -> perfil -> ruta admin denegada'
$stamp = (Get-Date -Format 'HHmmssffff')
$newEmail = "e2e${stamp}@demo.com"
$reg = Invoke-Api 'POST' "$Base/auth/register" @{ name = 'Usuario E2E'; email = $newEmail; password = 'Passw0rd!' }
Assert-Status $reg.Status 201 'registro nuevo usuario'

$regDup = Invoke-Api 'POST' "$Base/auth/register" @{ name = 'Usuario E2E'; email = $newEmail; password = 'Passw0rd!' }
Assert-Status $regDup.Status 409 'registro duplicado -> 409 EMAIL_ALREADY_REGISTERED'
Assert-True ((Get-Json $regDup.Body).code -eq 'EMAIL_ALREADY_REGISTERED') 'codigo EMAIL_ALREADY_REGISTERED'

$loginNew = Invoke-Api 'POST' "$Base/auth/login" @{ email = $newEmail; password = 'Passw0rd!' }
Assert-Status $loginNew.Status 200 'login del usuario nuevo'
$newToken = (Get-Json $loginNew.Body).token

$me = Invoke-Api 'GET' "$Base/users/me" $null $newToken
Assert-Status $me.Status 200 'GET /users/me'
Assert-True ((Get-Json $me.Body).email -eq $newEmail) 'perfil devuelve el email correcto'

$adminDenied = Invoke-Api 'GET' "$Base/admin/products" $null $newToken
Assert-Status $adminDenied.Status 403 'usuario comun sobre /admin/** -> 403'

# ============================================================================
# CP-2 : catalogo (navegar, buscar, detalle) + admin CRUD
# ============================================================================
Write-Step 'CP-2: catalogo publico + CRUD admin de productos'
$cat = Invoke-Api 'GET' "$Base/products?page=0&size=10"
Assert-Status $cat.Status 200 'GET /products'
Assert-True ((Get-Json $cat.Body).totalElements -eq 8) 'catalogo con 8 productos del seed'

$catSearch = Invoke-Api 'GET' "$Base/products?search=teclado"
Assert-Status $catSearch.Status 200 'busqueda "teclado"'
Assert-True ((Get-Json $catSearch.Body).totalElements -ge 1) 'la busqueda devuelve el teclado'

$detail = Invoke-Api 'GET' "$Base/products/$P_LAPTOP"
Assert-Status $detail.Status 200 'detalle de producto'
Assert-True ((Get-Json $detail.Body).name -like 'Laptop*') 'nombre del detalle'

# CRUD admin
$created = Invoke-Api 'POST' "$Base/admin/products" @{
    name = 'Producto E2E'; description = 'Creado por el e2e'
    price = 12345; stock = 7; imageUrl = '/img/e2e.webp'
} $adminToken
Assert-Status $created.Status 201 'admin crea producto'
$newId = (Get-Json $created.Body).id

$updated = Invoke-Api 'PUT' "$Base/admin/products/$newId" @{
    name = 'Producto E2E v2'; description = 'Actualizado'
    price = 22222; stock = 7; imageUrl = '/img/e2e.webp'
} $adminToken
Assert-Status $updated.Status 200 'admin actualiza producto'
Assert-True ((Get-Json $updated.Body).name -eq 'Producto E2E v2') 'nombre actualizado'

$adj = Invoke-Api 'PATCH' "$Base/admin/products/$newId/stock" @{ stock = 3 } $adminToken
Assert-Status $adj.Status 200 'admin ajusta stock'
Assert-True ((Get-Json $adj.Body).stock -eq 3) 'stock ajustado a 3'

$deleted = Invoke-Api 'DELETE' "$Base/admin/products/$newId" $null $adminToken
Assert-Status $deleted.Status 200 'admin desactiva producto (soft delete)'

$hidden = Invoke-Api 'GET' "$Base/products/$newId"
Assert-Status $hidden.Status 404 'producto desactivado invisible en el publico (404)'

# ============================================================================
# CP-3 : carrito (agregar, cambiar cantidad, persistencia)
# ============================================================================
Write-Step 'CP-3: carrito - agregar, cantidades, persistencia'
$cart0 = Invoke-Api 'GET' "$Base/cart" $null $userToken
Assert-Status $cart0.Status 200 'GET /cart (vacio)'
Assert-True (((Get-Json $cart0.Body).items).Count -eq 0) 'carrito inicial vacio'

$add1 = Invoke-Api 'POST' "$Base/cart/items" @{ productId = $P_TECLADO; quantity = 2 } $userToken
Assert-Status $add1.Status 200 'agregar teclado x2'
$add2 = Invoke-Api 'POST' "$Base/cart/items" @{ productId = $P_MOUSE; quantity = 1 } $userToken
Assert-Status $add2.Status 200 'agregar mouse x1'

$cart1 = Invoke-Api 'GET' "$Base/cart" $null $userToken
$cart1j = Get-Json $cart1.Body
Assert-True ($cart1j.items.Count -eq 2) 'carrito con 2 items'
$expectedSubtotal = (2 * 189900) + (1 * 99900)
Assert-True ([double]$cart1j.subtotal -eq $expectedSubtotal) "subtotal correcto ($expectedSubtotal)"

$mouseItem = $cart1j.items | Where-Object { $_.productId -eq $P_MOUSE } | Select-Object -First 1
$upd = Invoke-Api 'PATCH' "$Base/cart/items/$($mouseItem.id)" @{ quantity = 3 } $userToken
Assert-Status $upd.Status 200 'cambiar cantidad del mouse a 3'
Assert-True ((Get-Json $upd.Body).items.Count -eq 2) 'siguen 2 items tras cambiar cantidad'

# Persistencia: otra lectura (simula recarga) mantiene el contenido
$cart2 = Invoke-Api 'GET' "$Base/cart" $null $userToken
Assert-True (((Get-Json $cart2.Body).items).Count -eq 2) 'persistencia: el carrito sobrevive a la re-lectura'

# Stock insuficiente en el carrito
$over = Invoke-Api 'POST' "$Base/cart/items" @{ productId = $P_CABLE; quantity = 3 } $userToken
Assert-Status $over.Status 409 'exceder stock (cable, disponible 2) -> 409'
Assert-True ((Get-Json $over.Body).code -eq 'INSUFFICIENT_STOCK') 'codigo INSUFFICIENT_STOCK'

# Limpiar el carrito para el CP-4
$cartNow = Invoke-Api 'GET' "$Base/cart" $null $userToken
foreach ($it in (Get-Json $cartNow.Body).items) {
    Invoke-Api 'DELETE' "$Base/cart/items/$($it.id)" $null $userToken | Out-Null
}
$cartEmpty = Invoke-Api 'GET' "$Base/cart" $null $userToken
Assert-True (((Get-Json $cartEmpty.Body).items).Count -eq 0) 'carrito limpio antes del CP-4'

# ============================================================================
# CP-4 : compra exitosa; rechazo ...0002 (PENDING, stock intacto); reintento
# ============================================================================
Write-Step 'CP-4: checkout exitoso, rechazo (PENDING) y reintento'

# Stock previo del teclado (GET /products/{id} es publico y expone el stock)
$stockBeforeVal = (Get-Json (Invoke-Api 'GET' "$Base/products/$P_TECLADO").Body).stock

# Compra exitosa
Invoke-Api 'POST' "$Base/cart/items" @{ productId = $P_TECLADO; quantity = 1 } $userToken | Out-Null
$payOk = Invoke-Api 'POST' "$Base/checkout" @{
    shippingAddress = 'Cra 15 # 45-32, Bogota'
    payment = @{ method = 'Visa'; cardNumber = '4242424242424242'; cardholderName = 'E2E User' }
} $userToken
Assert-Status $payOk.Status 201 'checkout exitoso -> 201'
$okOrder = Get-Json $payOk.Body
Assert-True ($okOrder.status -eq 'PAID') 'orden exitosa queda PAID'

$stockAfter = (Get-Json (Invoke-Api 'GET' "$Base/products/$P_TECLADO").Body).stock
Assert-True ($stockAfter -eq ($stockBeforeVal - 1)) "stock descontado ($stockBeforeVal -> $stockAfter)"

$cartAfterPay = Invoke-Api 'GET' "$Base/cart" $null $userToken
Assert-True (((Get-Json $cartAfterPay.Body).items).Count -eq 0) 'carrito vaciado tras el pago'

# Compra rechazada (tarjeta ...0002)
Invoke-Api 'POST' "$Base/cart/items" @{ productId = $P_MOUSE; quantity = 1 } $userToken | Out-Null
$mouseStockBefore = (Get-Json (Invoke-Api 'GET' "$Base/products/$P_MOUSE").Body).stock
$payDeclined = Invoke-Api 'POST' "$Base/checkout" @{
    shippingAddress = 'Cra 15 # 45-32, Bogota'
    payment = @{ method = 'Visa'; cardNumber = '4242424242420002'; cardholderName = 'E2E User' }
} $userToken
Assert-Status $payDeclined.Status 402 'checkout rechazado -> 402'
Assert-True ((Get-Json $payDeclined.Body).code -eq 'PAYMENT_DECLINED') 'codigo PAYMENT_DECLINED'

$mouseStockAfterDecline = (Get-Json (Invoke-Api 'GET' "$Base/products/$P_MOUSE").Body).stock
Assert-True ($mouseStockAfterDecline -eq $mouseStockBefore) 'tras el rechazo el stock NO se descuenta'

# La orden rechazada queda PENDING y visible para el admin
$adminOrders = Invoke-Api 'GET' "$Base/admin/orders?status=PENDING" $null $adminToken
Assert-True (((Get-Json $adminOrders.Body).totalElements) -ge 1) 'la orden rechazada queda PENDING (visible en admin)'

# Reintento con tarjeta valida
$payRetry = Invoke-Api 'POST' "$Base/checkout" @{
    shippingAddress = 'Cra 15 # 45-32, Bogota'
    payment = @{ method = 'Visa'; cardNumber = '4242424242424242'; cardholderName = 'E2E User' }
} $userToken
Assert-Status $payRetry.Status 201 'reintento con tarjeta valida -> 201'
Assert-True ((Get-Json $payRetry.Body).status -eq 'PAID') 'reintento queda PAID'

# ============================================================================
# CP-5 : mis ordenes; admin envia -> entrega; cancela y stock restaurado
# ============================================================================
Write-Step 'CP-5: mis ordenes + maquina de estados admin + restitucion de stock'
$mine = Invoke-Api 'GET' "$Base/orders/mine?page=0&size=10" $null $userToken
Assert-Status $mine.Status 200 'GET /orders/mine'
$mineList = (Get-Json $mine.Body).content
Assert-True ($mineList.Count -ge 2) 'el usuario ve al menos 2 ordenes'

$firstOrder = $mineList | Where-Object { $_.status -eq 'PAID' } | Select-Object -First 1
$od = Invoke-Api 'GET' "$Base/orders/mine/$($firstOrder.id)" $null $userToken
Assert-Status $od.Status 200 'detalle de mi orden'
Assert-True (((Get-Json $od.Body).items).Count -ge 1) 'detalle incluye items'

# Aislamiento: un orden ajena no es visible
$foreign = Invoke-Api 'GET' "$Base/orders/mine/00000000-0000-0000-0000-000000000101" $null $userToken
Assert-Status $foreign.Status 404 'orden inexistente/ajena -> 404 ORDER_NOT_FOUND'

# Admin: enviar -> entregar una orden PAID
$allPaid = Invoke-Api 'GET' "$Base/admin/orders?status=PAID" $null $adminToken
$toShip = (Get-Json $allPaid.Body).content | Select-Object -First 1
$ship = Invoke-Api 'PATCH' "$Base/admin/orders/$($toShip.id)/status" @{ status = 'SHIPPED' } $adminToken
Assert-Status $ship.Status 200 'admin envia (PAID -> SHIPPED)'
$deliv = Invoke-Api 'PATCH' "$Base/admin/orders/$($toShip.id)/status" @{ status = 'DELIVERED' } $adminToken
Assert-Status $deliv.Status 200 'admin entrega (SHIPPED -> DELIVERED)'
Assert-True ((Get-Json $deliv.Body).status -eq 'DELIVERED') 'estado final DELIVERED'

# Transicion invalida: DELIVERED -> SHIPPED
$invalid = Invoke-Api 'PATCH' "$Base/admin/orders/$($toShip.id)/status" @{ status = 'SHIPPED' } $adminToken
Assert-Status $invalid.Status 409 'transicion invalida (DELIVERED -> SHIPPED) -> 409'
Assert-True ((Get-Json $invalid.Body).code -eq 'ORDER_STATUS_INVALID') 'codigo ORDER_STATUS_INVALID'

# Admin: cancelar una orden PAID -> stock restaurado
$toCancel = (Get-Json (Invoke-Api 'GET' "$Base/admin/orders?status=PAID" $null $adminToken).Body).content | Select-Object -First 1
if ($null -ne $toCancel) {
    # Identificar un item de la orden para verificar el stock restaurado
    $cancelDetail = Get-Json (Invoke-Api 'GET' "$Base/admin/orders/$($toCancel.id)" $null $adminToken).Body
    $item0 = $cancelDetail.items | Select-Object -First 1
    $prodStockBefore = (Get-Json (Invoke-Api 'GET' "$Base/products/$($item0.productId)").Body).stock
    $cancel = Invoke-Api 'PATCH' "$Base/admin/orders/$($toCancel.id)/status" @{ status = 'CANCELLED' } $adminToken
    Assert-Status $cancel.Status 200 'admin cancela (PAID -> CANCELLED)'
    Assert-True ((Get-Json $cancel.Body).status -eq 'CANCELLED') 'estado final CANCELLED'
    $prodStockAfter = (Get-Json (Invoke-Api 'GET' "$Base/products/$($item0.productId)").Body).stock
    Assert-True ($prodStockAfter -eq ($prodStockBefore + $item0.quantity)) "stock restaurado tras cancelar ($prodStockBefore -> $prodStockAfter)"
} else {
    Write-Host '  (sin ordenes PAID disponibles para cancelar; se omite la verificacion de restitucion)' -ForegroundColor DarkYellow
}

# ============================================================================
# Resumen
# ============================================================================
Write-Host "`n================ RESUMEN E2E ================" -ForegroundColor White
Write-Host "  Aserciones pasadas: $pass" -ForegroundColor Green
Write-Host "  Aserciones fallidas: $fail" -ForegroundColor $(if ($fail -gt 0) { 'Red' } else { 'Green' })
if ($fail -gt 0) { exit 1 } else { exit 0 }
