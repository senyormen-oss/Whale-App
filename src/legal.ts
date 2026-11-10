// ---------------------------------------------------------------------------
// Legal copy in English, Russian and Uzbek (Latin).
// THIS IS A DRAFT, not legal advice: have a lawyer qualified in Uzbekistan review
// all three versions before the public launch (see the checklist at the bottom).
// Fill in the operator details once the business entity exists.
// ---------------------------------------------------------------------------

import type { Lang } from './i18n'

export const LEGAL = {
  /** A real, monitored address. Shown to users for support and privacy requests. */
  contactEmail: 'e5270816@gmail.com',
  termsVersion: '2026-11-05',
  privacyVersion: '2026-11-05',
  updatedIso: '2026-11-05',
}

export interface LegalSection {
  heading: string
  body: string[]
}

const OPERATOR: Record<Lang, string> = {
  en: 'the Whale team',
  ru: 'команда Whale',
  uz: 'Whale jamoasi',
}

function contact(lang: Lang): string {
  if (LEGAL.contactEmail) {
    return { en: `You can contact us at ${LEGAL.contactEmail}.`, ru: `Связаться с нами можно по адресу ${LEGAL.contactEmail}.`, uz: `Biz bilan ${LEGAL.contactEmail} manzili orqali bog'lanishingiz mumkin.` }[lang]
  }
  return {
    en: 'You can contact us through the support option published in the app.',
    ru: 'Связаться с нами можно через раздел поддержки, опубликованный в приложении.',
    uz: "Biz bilan ilovada ko'rsatilgan qo'llab-quvvatlash orqali bog'lanishingiz mumkin.",
  }[lang]
}

function terms(lang: Lang): LegalSection[] {
  const op = OPERATOR[lang]
  if (lang === 'ru') {
    return [
      { heading: '1. О Whale', body: [
        `Whale — онлайн-маркетплейс, которым управляет ${op} («Whale», «мы»). Он помогает клиентам находить независимых креативных и цифровых специалистов (фотографов, видеографов, дизайнеров, маркетологов и других) и договариваться с ними о бронировании.`,
        'Создавая аккаунт или пользуясь сервисом, вы соглашаетесь с настоящими Условиями. Если вы не согласны, не пользуйтесь Whale.',
      ] },
      { heading: "2. Наша роль", body: [
        "Whale — платформа, которая соединяет клиентов с независимыми специалистами. Специалисты — независимые профессионалы, а не сотрудники или представители Whale. Сама услуга — это соглашение между клиентом и специалистом. Whale не является его стороной и не гарантирует качество, безопасность, законность или сроки оказания услуг.",
        "Команда Whale может помогать сторонам связаться и согласовать детали, например по телефону. Профили, портфолио, рейтинги и отзывы публикуют пользователи и команда; мы не проверяем каждое утверждение.",
      ] },
      { heading: '3. Аккаунт', body: [
        'Вам должно быть не менее 18 лет, а данные должны быть достоверными. Вы отвечаете за сохранность пароля и за все действия в вашем аккаунте.',
        'Вы можете закрыть аккаунт в любой момент: Профиль → Настройки → Удалить аккаунт. При этом ваш профиль, бронирования, сообщения и избранное будут удалены без возможности восстановления.',
      ] },
      { heading: "4. Бронирования и оплата", body: [
        "Клиент отправляет заявку с желаемой датой, временем и пакетом. Заявка ещё не является подтверждённым бронированием: сотрудник Whale связывается с клиентом по телефону и согласует детали, а слот закрепляется только после подтверждения. Клиент может отменить заявку или бронь на экране «Мои бронирования».",
        "Оплата: Whale не принимает, не удерживает и не переводит платежи. Цену и способ оплаты клиент и специалист согласуют между собой напрямую. Цены в приложении ориентировочные. Whale не отвечает за расчёты между ними.",
      ] },
      { heading: '5. Отзывы и контент', body: [
        'Оставить отзыв может только клиент, чьё бронирование завершено, и только один раз. Отзыв должен быть честным и основанным на вашем опыте. Вы сохраняете права на загружаемый контент и предоставляете Whale неисключительную лицензию на его хранение и показ в сервисе, пока он в нём размещён.',
        'У вас должны быть права на всё, что вы загружаете (включая фотографии и работы в портфолио).',
      ] },
      { heading: '6. Правила использования', body: [
        'Запрещено: нарушать закон; оскорблять, запугивать или дискриминировать других; публиковать сексуальный, жестокий или вводящий в заблуждение контент; выдавать себя за другого; накручивать рейтинг и отзывы; пытаться обойти защиту или получить чужие данные; рассылать спам; использовать сервис для незаконных договорённостей.',
        'Мы можем удалять контент, ограничивать функции или блокировать аккаунты, нарушающие эти правила или создающие риск для других.',
      ] },
      { heading: '7. Ответственность', body: [
        'Whale предоставляется «как есть». В максимально допустимой законом степени мы не отвечаем за действия и бездействие пользователей, за сорванные или некачественные сеансы и за косвенные убытки. Ничто в Условиях не ограничивает ответственность, которую нельзя ограничить по закону.',
      ] },
      { heading: '8. Изменения и прекращение', body: [
        'Мы можем обновлять Условия. О существенных изменениях мы сообщим в приложении. Продолжая пользоваться Whale после обновления, вы принимаете его. Мы можем приостановить или прекратить работу сервиса или аккаунта, если это нужно для защиты пользователей и платформы.',
      ] },
      { heading: '9. Применимое право и контакты', body: [
        'К настоящим Условиям применяется право Республики Узбекистан, споры рассматриваются компетентными судами этой страны, без ущерба для прав потребителя, установленных законом.',
        contact(lang),
      ] },
    ]
  }
  if (lang === 'uz') {
    return [
      { heading: '1. Whale haqida', body: [
        `Whale — ${op} ("Whale", "biz") tomonidan boshqariladigan onlayn marketpleys. U mijozlarga mustaqil ijodiy va raqamli mutaxassislarni (fotograflar, videograflar, dizaynerlar, marketologlar va boshqalar) topish hamda ular bilan band qilish bo'yicha kelishishga yordam beradi.`,
        "Hisob yaratish yoki xizmatdan foydalanish orqali siz ushbu Shartlarga rozilik bildirasiz. Rozi bo'lmasangiz, Whale'dan foydalanmang.",
      ] },
      { heading: "2. Bizning rolimiz", body: [
        "Whale — mijozlarni mustaqil mutaxassislar bilan bog'laydigan platforma. Mutaxassislar mustaqil kasb egalari bo'lib, Whale'ning xodimlari yoki vakillari emas. Xizmatning o'zi mijoz va mutaxassis o'rtasidagi kelishuvdir. Whale uning tomoni emas va xizmat sifati, xavfsizligi, qonuniyligi yoki muddatiga kafolat bermaydi.",
        "Whale jamoasi tomonlarga bog'lanish va tafsilotlarni kelishishda, masalan, telefon orqali yordam berishi mumkin. Profillar, portfoliolar, reytinglar va sharhlarni foydalanuvchilar va jamoa joylashtiradi; biz har bir ma'lumotni tekshirmaymiz.",
      ] },
      { heading: '3. Hisob', body: [
        "Yoshingiz kamida 18 da bo'lishi va ma'lumotlaringiz to'g'ri bo'lishi kerak. Parol sir saqlanishi va hisobingizdagi barcha harakatlar uchun o'zingiz javobgarsiz.",
        "Hisobni istalgan vaqtda yopishingiz mumkin: Profil → Sozlamalar → Hisobni o'chirish. Bunda profilingiz, band qilishlaringiz, xabarlaringiz va tanlanganlaringiz butunlay o'chiriladi.",
      ] },
      { heading: "4. Band qilish va to'lov", body: [
        "Mijoz xohlagan sana, vaqt va paket bilan so'rov yuboradi. So'rov hali tasdiqlangan bron emas: Whale xodimi mijoz bilan telefon orqali bog'lanib, tafsilotlarni kelishadi, vaqt oralig'i esa faqat tasdiqlangandan keyin biriktiriladi. Mijoz so'rov yoki bronni \"Mening bronlarim\" ekranida bekor qilishi mumkin.",
        "To'lov: Whale to'lovlarni qabul qilmaydi, ushlab turmaydi va o'tkazmaydi. Narx va to'lov usulini mijoz bilan mutaxassis o'zaro bevosita kelishadi. Ilovadagi narxlar taxminiy. Whale ular o'rtasidagi hisob-kitoblar uchun javobgar emas.",
      ] },
      { heading: '5. Sharhlar va kontent', body: [
        "Sharhni faqat bron yakunlangan mijoz va faqat bir marta qoldirishi mumkin. Sharh halol va shaxsiy tajribangizga asoslangan bo'lishi kerak. Yuklagan kontentingizga bo'lgan huquqlar sizda qoladi, Whale'ga esa uni xizmatda joylashtirilgan davrda saqlash va ko'rsatish uchun eksklyuziv bo'lmagan litsenziya berasiz.",
        "Yuklagan barcha narsalarga (suratlar va portfolio ishlari ham) huquqingiz bo'lishi kerak.",
      ] },
      { heading: '6. Foydalanish qoidalari', body: [
        "Taqiqlanadi: qonunni buzish; boshqalarni haqorat qilish, qo'rqitish yoki kamsitish; shahvoniy, zo'ravon yoki chalg'ituvchi kontent joylashtirish; boshqa shaxs nomidan harakat qilish; reyting va sharhlarni sun'iy oshirish; himoyani aylanib o'tishga yoki begona ma'lumotlarga kirishga urinish; spam yuborish; xizmatdan noqonuniy kelishuvlar uchun foydalanish.",
        "Biz ushbu qoidalarni buzgan yoki boshqalarga xavf tug'diradigan kontentni o'chirishimiz, imkoniyatlarni cheklashimiz yoki hisoblarni bloklashimiz mumkin.",
      ] },
      { heading: '7. Javobgarlik', body: [
        "Whale \"borligicha\" taqdim etiladi. Qonun ruxsat bergan maksimal darajada biz foydalanuvchilarning harakati yoki harakatsizligi, o'tkazilmagan yoki sifatsiz seanslar va bilvosita zararlar uchun javobgar emasmiz. Ushbu Shartlardagi hech narsa qonunga ko'ra cheklab bo'lmaydigan javobgarlikni cheklamaydi.",
      ] },
      { heading: "8. O'zgartirishlar va to'xtatish", body: [
        "Biz Shartlarni yangilashimiz mumkin. Muhim o'zgarishlar haqida ilovada xabar beramiz. Yangilanishdan keyin Whale'dan foydalanishni davom ettirsangiz, uni qabul qilgan hisoblanasiz. Foydalanuvchilar va platformani himoya qilish zarur bo'lsa, xizmat yoki hisobni to'xtatishimiz mumkin.",
      ] },
      { heading: '9. Qo\'llaniladigan huquq va aloqa', body: [
        "Ushbu Shartlarga O'zbekiston Respublikasi qonunchiligi qo'llaniladi, nizolar shu davlatning vakolatli sudlarida ko'riladi; qonun bilan belgilangan iste'molchi huquqlari saqlanadi.",
        contact(lang),
      ] },
    ]
  }
  return [
    { heading: '1. About Whale', body: [
      `Whale is an online marketplace operated by ${op} ("Whale", "we"). It lets clients discover independent creative and digital specialists (photographers, videographers, designers, marketers and similar) and arrange bookings with them.`,
      'By creating an account or using the service you agree to these Terms. If you do not agree, do not use Whale.',
    ] },
    { heading: "2. Our role", body: [
        "Whale is a platform that connects clients with independent specialists. Specialists are independent professionals, not employees or agents of Whale. The service itself is an agreement between the client and the specialist. Whale is not a party to that agreement and does not guarantee the quality, safety, legality or timing of any service.",
        "The Whale team may help the two sides to get in touch and agree the details, for example by phone. Specialist profiles, portfolios, ratings and reviews are provided by users and the team; we do not verify every statement.",
      ] },
    { heading: '3. Accounts', body: [
      'You must be at least 18 years old and provide accurate information. You are responsible for keeping your password confidential and for all activity under your account.',
      'You may close your account at any time from Profile → Settings → Delete account. Closing it permanently erases your profile, bookings, messages and favorites.',
    ] },
    { heading: "4. Bookings and payments", body: [
        "Clients send a booking request with a preferred date, time and package. A request is not yet a confirmed booking: a member of the Whale team contacts the client by phone to agree the details, and a time slot is reserved only after the request is confirmed. Clients can cancel a request or booking from the My Bookings screen.",
        "Payment: Whale does not accept, hold or transfer payments. The client and the specialist agree the price and the way of payment between themselves, directly. Prices shown in the app are indicative. Whale is not responsible for settlements between them.",
      ] },
    { heading: '5. Reviews and content', body: [
      'Only a client who completed a booking may review it, once. Reviews must be honest and based on your own experience. You keep ownership of the content you upload, and you grant Whale a non-exclusive licence to host and display it in the service for as long as it is on the service.',
      'You must have the rights to anything you upload (including photos and portfolio items).',
    ] },
    { heading: '6. Acceptable use', body: [
      "Do not: break the law; harass, threaten or discriminate against others; post sexual, violent or deceptive content; impersonate anyone; manipulate ratings or reviews; try to bypass security or access other users' data; send spam; or use the service to arrange anything illegal.",
      'We may remove content, restrict features or suspend accounts that break these rules or put others at risk.',
    ] },
    { heading: '7. Liability', body: [
      'Whale is provided "as is". To the maximum extent permitted by law, we are not liable for the acts or omissions of users, for missed or poor-quality sessions, or for indirect or consequential losses. Nothing in these Terms limits liability that cannot be limited by law.',
    ] },
    { heading: '8. Changes and termination', body: [
      'We may update these Terms. When the changes are material we will tell you in the app. Continuing to use Whale after an update means you accept it. We may suspend or end the service or an account where needed to protect users or the platform.',
    ] },
    { heading: '9. Governing law and contact', body: [
      'These Terms are governed by the laws of the Republic of Uzbekistan, and disputes are subject to the competent courts there, without limiting any consumer rights you have by law.',
      contact(lang),
    ] },
  ]
}

function privacy(lang: Lang): LegalSection[] {
  if (lang === 'ru') {
    return [
      { heading: '1. Что мы собираем', body: [
        'Данные аккаунта: имя, адрес электронной почты и пароль (пароль хранится только в виде защищённого хеша у нашего провайдера аутентификации).',
        'Данные об активности: бронирования, которые вы создаёте или получаете, сообщения и фотографии, избранные специалисты, написанные отзывы.',
        'Анкеты специалистов: данные профиля, которые вы решили опубликовать (имя, город, возраст, описание, навыки, цена). Они общедоступны.',
        'Технические данные, необходимые для работы сервиса, например токен сессии. Мы не используем рекламные трекеры и стороннюю аналитику.',
      ] },
      { heading: '2. Зачем мы это используем', body: [
        'Чтобы создавать и защищать аккаунт, позволять бронировать и общаться, показывать публичные профили и отзывы, предотвращать злоупотребления и мошенничество и соблюдать закон.',
      ] },
      { heading: "3. Кто видит ваши данные", body: [
        "Ваши сообщения и бронирования видны только вам и второй стороне этого бронирования или диалога. Анкеты специалистов и отзывы общедоступны. Номер телефона и комментарий из заявки видны команде Whale и могут быть переданы специалисту, у которого вы бронируете, чтобы организовать сеанс.",
        "Мы никогда не продаём ваши данные.",
      ] },
      { heading: '4. Поставщики услуг и место хранения', body: [
        'Мы используем Supabase для базы данных, аутентификации и хранения файлов и Vercel для работы сайта. Сейчас данные хранятся в дата-центре за пределами Узбекистана, поэтому использование Whale предполагает трансграничную передачу данных. Мы перенесём хранение, если этого потребуют местные правила о размещении данных.',
      ] },
      { heading: '5. Хранение на вашем устройстве', body: [
        'Whale хранит на устройстве только необходимое: сессию входа, выбранный язык и настройку уведомлений. Рекламные и отслеживающие cookie не используются, поэтому баннер cookie не нужен.',
      ] },
      { heading: '6. Как долго мы храним данные', body: [
        'Мы храним данные, пока ваш аккаунт активен. Когда вы удаляете аккаунт (Профиль → Настройки → Удалить аккаунт), ваш профиль, бронирования, сообщения, избранное, загруженные фотографии и анкета специалиста удаляются безвозвратно. Написанные вами отзывы могут остаться без вашего имени.',
      ] },
      { heading: '7. Ваши права', body: [
        'Вы можете просматривать и исправлять свои данные в приложении и в любой момент удалить аккаунт. Вы также можете запросить разъяснения об обработке данных или потребовать прекратить обработку в пределах, допустимых законом.',
        contact(lang),
      ] },
      { heading: '8. Дети', body: ['Whale предназначен для лиц старше 18 лет. Мы сознательно не собираем данные детей.'] },
      { heading: '9. Изменения', body: ['О существенных изменениях политики мы сообщим в приложении. Дата последнего обновления указана вверху страницы.'] },
    ]
  }
  if (lang === 'uz') {
    return [
      { heading: "1. Nimalarni yig'amiz", body: [
        "Hisob ma'lumotlari: ismingiz, elektron pochta manzilingiz va parol (parol autentifikatsiya provayderimizda faqat himoyalangan xesh ko'rinishida saqlanadi).",
        "Faollik ma'lumotlari: siz yaratgan yoki qabul qilgan bronlar, yuborgan xabar va suratlaringiz, tanlangan mutaxassislar, yozgan sharhlaringiz.",
        "Mutaxassis anketalari: e'lon qilishni tanlagan profil ma'lumotlari (ism, shahar, yosh, tavsif, ko'nikmalar, narx). Ular hammaga ochiq.",
        "Xizmat ishlashi uchun zarur texnik ma'lumotlar, masalan, sessiya tokeni. Reklama trekerlari va uchinchi tomon tahlilidan foydalanmaymiz.",
      ] },
      { heading: '2. Nima uchun foydalanamiz', body: [
        "Hisobni yaratish va himoyalash, band qilish va muloqot qilish imkonini berish, ochiq profillar va sharhlarni ko'rsatish, suiiste'mol va firibgarlikning oldini olish hamda qonunga rioya qilish uchun.",
      ] },
      { heading: "3. Ma'lumotlaringizni kim ko'radi", body: [
        "Xabarlaringiz va bronlaringizni faqat siz va shu bron yoki suhbatning ikkinchi tomoni ko'radi. Mutaxassis anketalari va sharhlar hammaga ochiq. So'rovdagi telefon raqami va izohni Whale jamoasi ko'radi va seansni tashkil qilish uchun siz band qilgan mutaxassisga berilishi mumkin.",
        "Ma'lumotlaringizni hech qachon sotmaymiz.",
      ] },
      { heading: "4. Xizmat ko'rsatuvchilar va saqlash joyi", body: [
        "Ma'lumotlar bazasi, autentifikatsiya va fayllarni saqlash uchun Supabase'dan, saytni ishga tushirish uchun Vercel'dan foydalanamiz. Hozir ma'lumotlar O'zbekistondan tashqaridagi ma'lumotlar markazida saqlanadi, shuning uchun Whale'dan foydalanish ma'lumotlarni chet elga uzatishni nazarda tutadi. Mahalliy qoidalar talab qilsa, saqlashni ko'chiramiz.",
      ] },
      { heading: '5. Qurilmangizda saqlash', body: [
        "Whale qurilmangizda faqat zarur narsalarni saqlaydi: kirish sessiyasi, tanlangan til va bildirishnoma sozlamasi. Reklama yoki kuzatuv cookie-fayllari ishlatilmaydi, shuning uchun cookie bannerining keragi yo'q.",
      ] },
      { heading: "6. Ma'lumotlar qancha saqlanadi", body: [
        "Hisobingiz faol ekan, ma'lumotlarni saqlaymiz. Hisobni o'chirganingizda (Profil → Sozlamalar → Hisobni o'chirish) profilingiz, bronlaringiz, xabarlaringiz, tanlanganlaringiz, yuklangan suratlaringiz va mutaxassis anketangiz butunlay o'chiriladi. Yozgan sharhlaringiz ismingizsiz qolishi mumkin.",
      ] },
      { heading: '7. Sizning huquqlaringiz', body: [
        "Ma'lumotlaringizni ilovada ko'rishingiz va tuzatishingiz hamda istalgan vaqtda hisobni o'chirishingiz mumkin. Qonun doirasida ma'lumotlar qanday qayta ishlanishini tushuntirishni yoki qayta ishlashni to'xtatishni ham so'rashingiz mumkin.",
        contact(lang),
      ] },
      { heading: '8. Bolalar', body: ["Whale 18 yoshdan oshgan shaxslar uchun. Biz bolalarning ma'lumotlarini ongli ravishda yig'maymiz."] },
      { heading: "9. O'zgarishlar", body: ["Siyosatda muhim o'zgarishlar bo'lsa, ilovada xabar beramiz. Oxirgi yangilanish sanasi sahifaning yuqori qismida ko'rsatilgan."] },
    ]
  }
  return [
    { heading: '1. What we collect', body: [
      'Account data: your name, email address and password (stored only as a secure hash by our authentication provider).',
      'Activity data: bookings you make or receive, messages and photos you send, specialists you save as favorites, reviews you write.',
      'Specialist listings: the profile details you choose to publish (name, city, age, bio, skills, price). These are public.',
      'Technical data needed to run the service, such as your session token. We do not use advertising trackers or third-party analytics.',
    ] },
    { heading: '2. Why we use it', body: [
      'To create and secure your account, to let you book and communicate, to show public specialist profiles and reviews, to prevent abuse and fraud, and to comply with the law.',
    ] },
    { heading: "3. Who can see your data", body: [
        "Your messages and bookings are visible only to you and the other party to that booking or conversation. Specialist listings and reviews are public. The phone number and comment from a booking request are visible to the Whale team and may be passed to the specialist you booked, so that the session can be arranged.",
        "We never sell your data.",
      ] },
    { heading: '4. Service providers and where data is stored', body: [
      'We use Supabase to host the database, authentication and file storage, and Vercel to serve the website. Data is currently stored in a data-centre region outside Uzbekistan, so using Whale involves transferring your data abroad. We will move storage if local data-residency rules require it.',
    ] },
    { heading: '5. Storage on your device', body: [
      'Whale stores only what is strictly necessary on your device: your sign-in session, your chosen language and your notification preference. It does not use advertising or tracking cookies, so no cookie banner is needed.',
    ] },
    { heading: '6. How long we keep it', body: [
      'We keep your data while your account is active. When you delete your account (Profile → Settings → Delete account), your profile, bookings, messages, favorites, uploaded photos and any specialist listing are permanently erased. Reviews you wrote may remain without your name.',
    ] },
    { heading: '7. Your rights', body: [
      'You can access and correct your data in the app, and delete your account at any time. You may also ask us to explain how your data is processed or to stop processing it, subject to applicable law.',
      contact(lang),
    ] },
    { heading: '8. Children', body: ['Whale is for people aged 18 and over. We do not knowingly collect data from children.'] },
    { heading: '9. Changes', body: ['If we change this policy in a material way we will notify you in the app. The date of the latest update is shown at the top of this page.'] },
  ]
}

export function getLegalSections(doc: 'terms' | 'privacy', lang: Lang): LegalSection[] {
  return doc === 'terms' ? terms(lang) : privacy(lang)
}

/*
 * Pre-launch legal checklist (for the owner and their lawyer):
 *  - Register the business (e.g. IP / self-employed) and set LEGAL.contactEmail and the OPERATOR names.
 *  - Uzbekistan's personal-data law and its data-localisation rules may require citizens' personal data
 *    to be stored on servers in Uzbekistan and the database to be registered. Confirm with a local lawyer;
 *    this is the reason the project may later move to a local server.
 *  - Payment providers (Click, Payme, Uzum, Paynet) require their own merchant agreements and offer terms.
 *  - Decide on a refund / dispute policy before real payments go live.
 *  - Have a native speaker review the Russian and Uzbek wording.
 */
