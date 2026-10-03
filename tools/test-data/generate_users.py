import csv
import random
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Font


# ============================================================
# Configuración
# ============================================================

SEED = 2026
TOTAL_USERS = 10_000

CI_BASE = 900_000_000
RU_BASE = 99_000_000

OUTPUT_DIR = Path(__file__).parent / "output"

EXCEL_SIZES = [100, 1_000, 5_000, 10_000]

EXCEL_HEADERS = [
    "Nombres",
    "Apellidos",
    "CI",
    "RU",
    "Email",
]


# ============================================================
# Datos para generación
# ============================================================

FIRST_NAMES = [
    "Alejandro",
    "Andrea",
    "Andrés",
    "Ana",
    "Brenda",
    "Camila",
    "Carlos",
    "Carla",
    "Cristian",
    "Daniel",
    "Daniela",
    "David",
    "Diego",
    "Eduardo",
    "Elena",
    "Fernando",
    "Gabriela",
    "Javier",
    "José",
    "Juan",
    "Karen",
    "Laura",
    "Leonardo",
    "Luis",
    "María",
    "Mariana",
    "Miguel",
    "Natalia",
    "Paola",
    "Patricia",
    "Roberto",
    "Rodrigo",
    "Sofía",
    "Valeria",
    "Víctor",
]

LAST_NAMES = [
    "Aguilar",
    "Alarcón",
    "Arce",
    "Cabrera",
    "Castillo",
    "Condori",
    "Fernández",
    "Flores",
    "García",
    "Gutiérrez",
    "López",
    "Mamani",
    "Martínez",
    "Mendoza",
    "Morales",
    "Pérez",
    "Quispe",
    "Ramírez",
    "Rojas",
    "Romero",
    "Sánchez",
    "Silva",
    "Suárez",
    "Torrez",
    "Vargas",
    "Villca",
]


# ============================================================
# Generación
# ============================================================

def generate_name(rng: random.Random) -> str:
    """
    Genera uno o dos nombres.
    """
    first_name = rng.choice(FIRST_NAMES)

    # Aproximadamente 35 % tendrá segundo nombre.
    if rng.random() < 0.35:
        second_name = rng.choice(FIRST_NAMES)

        while second_name == first_name:
            second_name = rng.choice(FIRST_NAMES)

        return f"{first_name} {second_name}"

    return first_name


def generate_lastname(rng: random.Random) -> str:
    """
    Genera dos apellidos diferentes.
    """
    first_lastname = rng.choice(LAST_NAMES)
    second_lastname = rng.choice(LAST_NAMES)

    while second_lastname == first_lastname:
        second_lastname = rng.choice(LAST_NAMES)

    return f"{first_lastname} {second_lastname}"


def get_test_group(index: int) -> str:
    """
    Divide los 10.000 estudiantes en cinco grupos de 2.000.

    Estos grupos NO se incluyen en los Excel de importación.
    Servirán posteriormente para generar asignaciones a carreras
    y matrículas.
    """
    group_size = 2_000
    group_index = (index - 1) // group_size

    groups = ["A", "B", "C", "D", "E"]

    if group_index >= len(groups):
        return "UNASSIGNED"

    return groups[group_index]


def generate_users(total: int) -> list[dict]:
    rng = random.Random(SEED)

    users = []

    for index in range(1, total + 1):
        ci = str(CI_BASE + index)
        ru = str(RU_BASE + index)

        user = {
            "index": index,
            "name": generate_name(rng),
            "lastname": generate_lastname(rng),
            "ci": ci,
            "ru": ru,
            "email": f"student{index:06d}@example.test",
            "test_group": get_test_group(index),
        }

        users.append(user)

    return users


# ============================================================
# Validaciones
# ============================================================

def validate_users(users: list[dict]) -> None:
    if len(users) != TOTAL_USERS:
        raise ValueError(
            f"Se esperaban {TOTAL_USERS} usuarios, "
            f"pero se generaron {len(users)}."
        )

    cis = {user["ci"] for user in users}
    rus = {user["ru"] for user in users}
    emails = {user["email"] for user in users}

    if len(cis) != len(users):
        raise ValueError("Se encontraron CI duplicados.")

    if len(rus) != len(users):
        raise ValueError("Se encontraron RU duplicados.")

    if len(emails) != len(users):
        raise ValueError("Se encontraron emails duplicados.")

    required_fields = [
        "name",
        "lastname",
        "ci",
        "ru",
        "email",
    ]

    for user in users:
        for field in required_fields:
            if not user[field]:
                raise ValueError(
                    f"Campo obligatorio vacío: "
                    f"usuario {user['index']}, campo {field}."
                )


# ============================================================
# CSV maestro
# ============================================================

def save_master_csv(users: list[dict]) -> Path:
    path = OUTPUT_DIR / "master-users.csv"

    headers = [
        "index",
        "name",
        "lastname",
        "ci",
        "ru",
        "email",
        "test_group",
    ]

    with path.open(
        "w",
        newline="",
        encoding="utf-8-sig",
    ) as file:
        writer = csv.DictWriter(
            file,
            fieldnames=headers,
        )

        writer.writeheader()
        writer.writerows(users)

    return path


# ============================================================
# Excel
# ============================================================

def save_excel(users: list[dict], size: int) -> Path:
    path = OUTPUT_DIR / f"users-{size}.xlsx"

    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = "Usuarios"

    worksheet.append(EXCEL_HEADERS)

    # Encabezados en negrita.
    for cell in worksheet[1]:
        cell.font = Font(bold=True)

    for user in users[:size]:
        worksheet.append(
            [
                user["name"],
                user["lastname"],
                user["ci"],
                user["ru"],
                user["email"],
            ]
        )

    # Anchos básicos para facilitar inspección manual.
    worksheet.column_dimensions["A"].width = 24
    worksheet.column_dimensions["B"].width = 28
    worksheet.column_dimensions["C"].width = 16
    worksheet.column_dimensions["D"].width = 16
    worksheet.column_dimensions["E"].width = 38

    worksheet.freeze_panes = "A2"

    workbook.save(path)

    return path


# ============================================================
# Main
# ============================================================

def main() -> None:
    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    print("Generando dataset...")
    print(f"Seed: {SEED}")
    print()

    users = generate_users(TOTAL_USERS)

    validate_users(users)

    generated_files = []

    master_path = save_master_csv(users)
    generated_files.append(master_path)

    for size in EXCEL_SIZES:
        excel_path = save_excel(users, size)
        generated_files.append(excel_path)

    print("Dataset generado correctamente.")
    print()
    print(f"Usuarios:       {len(users)}")
    print(f"CI únicos:      {len({u['ci'] for u in users})}")
    print(f"RU únicos:      {len({u['ru'] for u in users})}")
    print(f"Emails únicos:  {len({u['email'] for u in users})}")
    print()
    print("Grupos de prueba:")

    for group in ["A", "B", "C", "D", "E"]:
        count = sum(
            1
            for user in users
            if user["test_group"] == group
        )

        print(f"  Grupo {group}: {count}")

    print()
    print("Archivos generados:")

    for file in generated_files:
        print(f"  {file}")


if __name__ == "__main__":
    main()