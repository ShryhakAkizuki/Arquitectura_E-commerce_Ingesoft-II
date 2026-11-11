# Evidencias SOLID y DRY


## O — Open/Closed Principle (OCP)

**Planteamiento:** abierto a extensión, cerrado a modificación.

| Evidencia planeada | Descripción |
|--------------------|-------------|
| Perfil `h2` sin tocar el código | El plan B sin PostgreSQL se resuelve con un perfil de configuración ([`application.yml`](../backend/src/main/resources/application.yml)), no con código condicional. |

## DRY — Don't Repeat Yourself

**Planteamiento:** cada regla de negocio, dato o concepto vive en **un único lugar** autoritativo.

| Evidencia planeada | Descripción |
|--------------------|-------------|
| Seed determinístico, reglas de negocio en la app | Los datos demo viven en [`V2__seed.sql`](../backend/src/main/resources/db/migration/V2__seed.sql) (un solo lugar); el código no lleva datos "dormidos" duplicados. |
| Parámetros de negocio en `application.yml` | Envío fijo (`checkout.shipping-fee`) y sufijo de rechazo (`checkout.card-declined-suffix`) se configuran una vez y se inyectan donde se usan. |
