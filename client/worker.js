// Добавим версию к кэшу. Изменив её, загрузится новый воркер, который при активации удалит старую версию кэша.
var CACHE_VERSION = 1;
var CACHE_NAME = 'shri-2016-task3-' + CACHE_VERSION;

// Проблема: Неправильно указаны пути до файлов
// Решение: Указать правильные урлы, либо переложить файлы. Выбираем первый вариант.
var urlsToCache = [
  '/',
  '/css/index.css',
  '/js/index.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                return cache.addAll(urlsToCache);
            })
    );
});

// При активации нового воркера удаляем старый кэш, если версия изменилась.
self.addEventListener('activate', (event) => {
    const expectedCacheName = CACHE_NAME;

    event.waitUntil(
        caches.keys().then((cachesNames) => {
            return Promise.all(
                cachesNames.map((cacheName) => {
                    if (cacheName !== expectedCacheName) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', function(event) {
    const requestURL = new URL(event.request.url);

    if (/^\/api\/v1/.test(requestURL.pathname)
        && (event.request.method !== 'GET' && event.request.method !== 'HEAD')) {
        return event.respondWith(fetch(event.request));
    }

    if (/^\/api\/v1/.test(requestURL.pathname)) {
        return event.respondWith(
            // Проблема: Не всегда обновляется список студентов после добавления нового.
            // После добавления студента, посылается запрос на получение нового списка,
            // а возвращался либо из кэша (старая версия), либо с сервера (новая), зависит от того что быстрее выполнится.
            // Решение: Меняем стратегию, и всегда берем данные с сервера, кладем их к кэш. Если не получилось,
            // берем из кэша.
            fetchAndPutToCache(event.request)
        );
    }

    // Проблемы: 1. Синтаксическая ошибка, точка с запятой не нужна.
    //           2. Функция fetchAndPutToCache ожидает получить объект Request в качестве первого аргумента,
    //              а в нашем случае ей передается значение "сфейленого" промиса.
    // Решение: Используя частичное применение/карринг, передаем в catch функцию с привязанным аргументом (объектом Request).
    return event.respondWith(
        getFromCache(event.request).catch(fetchAndPutToCache.bind({}, event.request))
    );
});

function fetchAndPutToCache(request) {
    // Нужно склонировать объект Request, т.к. это стрим и он будет считан дважды, в fetch() и в cache.put().
    return fetch(request.clone()).then((response) => {
        const responseToCache = response.clone();
        return caches.open(CACHE_NAME)
            .then((cache) => {
                cache.put(request, responseToCache);
            })
            .then(() => response);
    })
    .catch(() => caches.match(request));
}

function getFromCache(request) {
    return caches.match(request)
        .then((response) => {
            if (response) {
                return response;
            }

            return Promise.reject();
        });
}
