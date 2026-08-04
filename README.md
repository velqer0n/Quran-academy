# Коран — Изучение

Исламское веб-приложение: Коран, намаз, фикх, хадисы, словарь, ежедневное.

## Как выложить на GitHub Pages (бесплатно)

### 1. Аккаунт
Зайдите на https://github.com и войдите (или создайте аккаунт).

### 2. Новый репозиторий
1. Нажмите **+** (справа сверху) → **New repository**
2. Repository name: например `quran-academy`
3. Public
4. **Не** ставьте галочки README / .gitignore / license
5. **Create repository**

### 3. Загрузить файлы
На странице репозитория:
1. **Add file → Upload files**
2. Перетащите сюда:
   - `index.html`
   - `.nojekyll`
   - `README.md` (по желанию)
3. Внизу: **Commit changes**

Важно: `index.html` должен лежать **в корне** репозитория (не во вложенной папке).

### 4. Включить Pages
1. **Settings** (вкладки репозитория)
2. Слева: **Pages**
3. Build and deployment → Source: **Deploy from a branch**
4. Branch: **main** (или master), folder: **/ (root)**
5. **Save**

### 5. Открыть сайт
Через 1–3 минуты адрес будет:
`https://ВАШ_ЛОГИН.github.io/quran-academy/`

(подставьте свой логин GitHub и имя репозитория)

## Обновление
Замените `index.html` новой версией → Commit → сайт обновится сам.
