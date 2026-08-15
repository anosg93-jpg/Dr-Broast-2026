// قم بتغيير رقم الإصدار هنا (مثلاً v1.1 أو v2.0) كلما قمت برفع تعديلات جديدة في كود index.html
const CACHE_NAME = 'dr-broast-v9.0';

// الملفات الأساسية للتخزين المؤقت للعمل بدون إنترنت وبسرعة فائقة
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './images/logotempo.png',
  './images/default.jpg'
];

// 1. التثبيت الفوري للـ Service Worker الجديد وتجاوز الانتظار
self.addEventListener('install', (event) => {
  self.skipWaiting(); // تفعيل التحديث فوراً
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// 2. تفعيل وحذف الكاش القديم بالكامل عند وجود أي تحديث جديد
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key); // حذف الإصدارات القديمة فوراً
          }
        })
      );
    }).then(() => self.clients.claim()) // السيطرة الفورية على كل الصفحات المفتوحة
  );
});

// 3. استراتيجية جلب البيانات والملفات
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // أ. استثناء رابط جوجل شيت والطلبات الخارجية للواتساب: شبكة مباشرة دائماً بدون كاش (تحديث لحظي للشيت)
  if (requestUrl.hostname.includes('docs.google.com') || 
      requestUrl.hostname.includes('google.com') || 
      requestUrl.hostname.includes('wa.me')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // ب. لصفحة index.html: استراتيجية (Network-First)
  // يحاول تحميل النسخة الأحدث من السيرفر أولاً، وإذا كان العميل بدون نت يفتح الكاش
  if (event.request.mode === 'navigate' || event.request.url.endsWith('index.html')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // ج. لباقي الملفات والصور: استراتيجية (Stale-While-Revalidate) للسرعة الفائقة
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
          });
        }
        return networkResponse;
      }).catch(() => {});

      return cachedResponse || fetchPromise;
    })
  );
});
