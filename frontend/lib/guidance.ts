import type { Locale } from './i18n';

export const guidanceCopy = {
  welcome: ['How to get started', 'С чего начать', 'Неден бастау керек'],
  landing: [
    'Choose what you do: buy goods, supply goods, or deliver them. Create an account for that role, then follow the checklist in your workspace.',
    'Выберите свою задачу: заказать, произвести или доставить товар. Создайте аккаунт с нужной ролью, затем следуйте списку шагов в рабочем кабинете.',
    'Міндетіңізді таңдаңыз: тауар сатып алу, өндіру немесе жеткізу. Сол рөлмен тіркеліп, жұмыс кабинетіндегі қадамдарды орындаңыз.',
  ],
  customerRole: [
    'Customer: describe what you need, compare proposals, then manage the order and delivery.',
    'Заказчик: опишите нужный товар, сравните предложения, затем следите за заказом и доставкой.',
    'Тапсырыс беруші: қажетті тауарды сипаттап, ұсыныстарды салыстырыңыз, содан кейін тапсырыс пен жеткізуді бақылаңыз.',
  ],
  factoryRole: [
    'Factory: add available stock, bid on requests, then prepare selected orders for delivery.',
    'Производитель: добавьте остатки, отвечайте на заявки и готовьте выбранные заказы к доставке.',
    'Өндіруші: қолда бар тауарды қосып, өтінімдерге ұсыныс беріңіз және таңдалған тапсырыстарды жеткізуге дайындаңыз.',
  ],
  logistRole: [
    'Logistics provider: set up delivery services, quote for factory bids, then update shipment progress.',
    'Перевозчик: настройте услуги доставки, предложите перевозку по предложениям заводов и обновляйте статус отправлений.',
    'Тасымалдаушы: жеткізу қызметтерін реттеп, зауыт ұсыныстарына тасымалдау бағасын беріңіз және жөнелтілім күйін жаңартыңыз.',
  ],
  account: [
    'Your role determines your workspace. Use an email you can sign in with and a password of at least 8 characters. After registration, sign in to continue setup.',
    'Роль определяет ваш рабочий кабинет. Укажите email для входа и пароль от 8 символов. После регистрации войдите, чтобы продолжить настройку.',
    'Рөл жұмыс кабинетіңізді анықтайды. Кіру үшін email және кемінде 8 таңбалы құпиясөз көрсетіңіз. Тіркелген соң баптауды жалғастыру үшін кіріңіз.',
  ],
  identity: [
    'Use the name partners should recognise. For a factory or logistics company, enter the company name. Add a contact phone so partners can coordinate the order; the contact person’s name is optional.',
    'Укажите имя, по которому вас узнают партнёры. Для завода или перевозчика используйте название компании. Телефон нужен для связи по заказу; имя контактного лица необязательно.',
    'Серіктестер танитын атауды көрсетіңіз. Зауыт немесе тасымалдаушы үшін компания атауын жазыңыз. Телефон тапсырыс бойынша байланысуға қажет; байланыс тұлғасының аты міндетті емес.',
  ],
  accountStep: ['Account', 'Аккаунт', 'Аккаунт'],
  profileStep: ['Contact details', 'Контактные данные', 'Байланыс деректері'],
  locationStep: ['Address and currency', 'Адрес и валюта', 'Мекенжай және валюта'],
  reviewStep: [
    'Review and create account',
    'Проверьте данные и создайте аккаунт',
    'Деректерді тексеріп, аккаунт жасаңыз',
  ],
  continue: ['Continue', 'Продолжить', 'Жалғастыру'],
  back: ['Back', 'Назад', 'Артқа'],
  openStep: ['Open this section', 'Открыть раздел', 'Бөлімді ашу'],
  phoneHint: [
    'Required. Include the country code, for example +7 700 000 0000. Use 7–15 digits; spaces, brackets and hyphens are accepted.',
    'Обязательно. Укажите код страны, например +7 700 000 0000. Номер должен содержать 7–15 цифр; пробелы, скобки и дефисы допустимы.',
    'Міндетті. Ел кодын көрсетіңіз, мысалы +7 700 000 0000. Нөмірде 7–15 цифр болуы керек; бос орын, жақша және дефиске рұқсат етіледі.',
  ],
  phoneError: [
    'Enter a phone number with 7–15 digits. Only an initial +, spaces, brackets, dots and hyphens are allowed alongside digits.',
    'Введите телефон из 7–15 цифр. Кроме цифр допустимы + в начале, пробелы, скобки, точки и дефисы.',
    '7–15 цифрдан тұратын телефон нөмірін енгізіңіз. Цифрлардан бөлек басында +, бос орын, жақша, нүкте және дефиске рұқсат етіледі.',
  ],
  review: [
    'Check your role, contact details and address. Use Back to correct anything. Creating an account does not publish stock or place an order; you will set those up in your workspace.',
    'Проверьте роль, контакты и адрес. Для исправлений нажмите «Назад». Создание аккаунта не публикует остатки и не размещает заказ — это следующие шаги в кабинете.',
    'Рөлді, байланыс деректерін және мекенжайды тексеріңіз. Түзету үшін «Артқа» түймесін басыңыз. Аккаунт жасау тауар жарияламайды және тапсырыс бермейді — бұларды кабинетте жасайсыз.',
  ],
  address: [
    'Enter your full address so locations can be used in matching. Check country, region, city and street; you can specify an order’s delivery or stock address separately.',
    'Полный адрес нужен для подбора по расположению. Проверьте страну, область, город и улицу. Адрес доставки заказа или склада можно указать отдельно.',
    'Толық мекенжай орналасу бойынша іріктеуге қажет. Елді, облысты, қаланы және көшені тексеріңіз. Тапсырыстың жеткізу немесе қойма мекенжайын бөлек көрсетуге болады.',
  ],
  optionalService: [
    'This delivery profile is optional during registration. You can add services and prices later under Delivery services.',
    'Профиль доставки при регистрации необязателен. Услуги и цены можно добавить позже в разделе услуг доставки.',
    'Тіркелу кезінде жеткізу профилі міндетті емес. Қызметтер мен бағаларды кейін жеткізу қызметтері бөлімінде қосуға болады.',
  ],
  login: [
    'Sign in with the account you created. You will open the workspace for your role and can continue setup there.',
    'Войдите в созданный аккаунт. Откроется кабинет вашей роли, где можно продолжить настройку.',
    'Жасаған аккаунтыңызға кіріңіз. Рөліңізге сәйкес кабинет ашылып, баптауды сол жерде жалғастыра аласыз.',
  ],
  checklist: ['Your first steps', 'Первые шаги', 'Алғашқы қадамдар'],
  checklistIntro: [
    'Steps update from your saved work. Open a step for details; hiding this checklist keeps your progress. Its visibility is saved for this account in this browser.',
    'Шаги отмечаются по сохранённым данным. Откройте шаг для подробностей. Список можно скрыть без потери прогресса; настройка сохраняется для этого аккаунта в этом браузере.',
    'Қадамдар сақталған деректер бойынша белгіленеді. Мәлімет үшін қадамды ашыңыз. Тізімді жасырсаңыз да, нәтиже сақталады; баптау осы браузердегі аккаунтқа сақталады.',
  ],
  hide: ['Hide checklist', 'Скрыть список шагов', 'Қадамдар тізімін жасыру'],
  show: ['Show getting-started checklist', 'Показать первые шаги', 'Алғашқы қадамдарды көрсету'],
  done: ['Done', 'Готово', 'Дайын'],
  progress: ['steps completed', 'шагов выполнено', 'қадам орындалды'],
  next: ['What happens next', 'Что дальше', 'Әрі қарай не болады'],
  requestTitle: ['Create a supply request', 'Создайте заявку', 'Өтінім жасаңыз'],
  request: [
    'Describe the product and category so suppliers can assess it. Add quantity, unit, budget currency and destination so proposals can include the right goods and delivery.',
    'Опишите товар и категорию, чтобы поставщики могли оценить заявку. Укажите количество, единицу измерения, валюту бюджета и адрес: это нужно для подбора товара и доставки.',
    'Жеткізушілер бағалай алуы үшін тауар мен санатты сипаттаңыз. Тауар мен жеткізуді дұрыс іріктеу үшін санын, өлшем бірлігін, бюджет валютасын және мекенжайын көрсетіңіз.',
  ],
  quantity: [
    'Check the unit and currency before submitting: 100 kg and 100 pieces are different orders. A budget helps compare costs; it is not a payment.',
    'Перед отправкой проверьте единицу и валюту: 100 кг и 100 штук — разные заказы. Бюджет помогает сравнить стоимость, но не является оплатой.',
    'Жібермес бұрын өлшем бірлігі мен валютаны тексеріңіз: 100 кг мен 100 дана — әртүрлі тапсырыс. Бюджет құнын салыстыруға көмектеседі, ол төлем емес.',
  ],
  requests: [
    'Your saved requests appear here. Open proposals when they become available. If none are available yet, suppliers and logistics providers still need to respond; check the request details while you wait.',
    'Здесь появляются сохранённые заявки. Открывайте предложения по мере их поступления. Если предложений пока нет, поставщики и перевозчики ещё должны ответить; пока ждёте, проверьте данные заявки.',
    'Сақталған өтінімдер осында көрсетіледі. Ұсыныстар түскенде ашыңыз. Әзірге ұсыныс болмаса, жеткізушілер мен тасымалдаушылардың жауабы қажет; күту кезінде өтінім мәліметтерін тексеріңіз.',
  ],
  proposalTitle: [
    'Compare and select a proposal',
    'Сравните и выберите предложение',
    'Ұсыныстарды салыстырып, таңдаңыз',
  ],
  proposals: [
    'Compare total cost, delivery time and partners. A factory-only bid still needs delivery. Selecting a complete proposal creates an order with a contract to review; it does not take payment.',
    'Сравните полную стоимость, срок и партнёров. Предложению только от завода ещё нужна доставка. Выбор полного предложения создаёт заказ с договором для проверки; оплата не списывается.',
    'Жалпы құнын, мерзімін және серіктестерді салыстырыңыз. Тек зауыт ұсынысына әлі жеткізу қажет. Толық ұсынысты таңдау тексеруге арналған шарты бар тапсырыс жасайды; төлем алынбайды.',
  ],
  inventoryTitle: ['Add available stock', 'Добавьте остатки', 'Қолда бар тауарды қосыңыз'],
  inventory: [
    'Add the product, category, available quantity, unit price and stock address. These details let buyers compare supply and carriers quote delivery. Keep stock accurate; pause an entry when it is unavailable.',
    'Укажите товар, категорию, доступное количество, цену за единицу и адрес склада. Эти данные нужны заказчикам для сравнения, а перевозчикам — для расчёта доставки. Обновляйте остатки и приостанавливайте недоступные позиции.',
    'Тауарды, санатты, қолда бар санын, бірлік бағасын және қойма мекенжайын көрсетіңіз. Бұл сатып алушыларға салыстыруға, тасымалдаушыларға жеткізуді есептеуге қажет. Қорды жаңартып, жоқ позицияларды тоқтатыңыз.',
  ],
  bidTitle: [
    'Respond to a customer request',
    'Ответьте на заявку заказчика',
    'Тапсырыс берушінің өтініміне жауап беріңіз',
  ],
  bid: [
    'Choose stock that meets the request and check the quantity and price before bidding. Your bid is a proposal, not a confirmed order. Delivery can be added before the customer selects a complete proposal.',
    'Выберите подходящий товар со склада, проверьте количество и цену. Ставка — это предложение, а не подтверждённый заказ. Доставку можно добавить до выбора полного предложения заказчиком.',
    'Өтінімге сай қойма тауарын таңдап, санын және бағасын тексеріңіз. Бұл расталған тапсырыс емес, ұсыныс. Тапсырыс беруші толық ұсынысты таңдағанға дейін жеткізуді қосуға болады.',
  ],
  bids: [
    'Track the bids you have sent. The customer chooses a complete proposal; if yours is selected, the order appears in Production for contract review.',
    'Следите за отправленными предложениями. Заказчик выбирает полное предложение; если выбрано ваше, заказ появится в разделе производства для проверки договора.',
    'Жіберілген ұсыныстарды бақылаңыз. Тапсырыс беруші толық ұсынысты таңдайды; сіздікі таңдалса, шартты тексеру үшін тапсырыс өндіріс бөлімінде пайда болады.',
  ],
  serviceTitle: [
    'Set up a delivery service',
    'Настройте услугу доставки',
    'Жеткізу қызметін реттеңіз',
  ],
  service: [
    'Add your delivery service, price and currency so it can be used when preparing quotes. Describe the service clearly and check that each quoted route is one you can deliver.',
    'Добавьте услугу доставки, цену и валюту для подготовки предложений. Опишите услугу понятно и проверяйте, что можете выполнить каждый предлагаемый маршрут.',
    'Ұсыныс дайындауға арналған жеткізу қызметін, бағасын және валютасын қосыңыз. Қызметті анық сипаттап, әр ұсынылған бағытты орындай алатыныңызды тексеріңіз.',
  ],
  quoteTitle: ['Quote for a delivery', 'Предложите доставку', 'Жеткізу ұсынысын беріңіз'],
  quote: [
    'Review the factory’s goods, pickup and destination. Choose a delivery service and enter a realistic price and number of days. Your quote completes the proposal for the customer to compare; wait for selection before starting work.',
    'Проверьте товар завода, адреса погрузки и доставки. Выберите услугу, укажите реальную цену и срок в днях. Ваш расчёт дополняет предложение для сравнения заказчиком; начинайте работу после выбора и прохождения этапов заказа.',
    'Зауыт тауарын, алу және жеткізу мекенжайларын тексеріңіз. Қызметті таңдап, нақты баға мен күн санын көрсетіңіз. Бағаңыз ұсынысты толықтырады; жұмысты бастамас бұрын таңдау мен тапсырыс кезеңдерінің орындалуын күтіңіз.',
  ],
  signTitle: [
    'Review and sign the contract',
    'Проверьте и подпишите договор',
    'Шартты тексеріп, қол қойыңыз',
  ],
  sign: [
    'Review the parties, goods, addresses, total price and delivery terms before signing. Fill in the required agreement fields and confirm only when they are correct. Each party signs separately; the customer can pay after all required signatures.',
    'Перед подписью проверьте стороны, товар, адреса, полную цену и условия доставки. Заполните обязательные поля договора и подтвердите верные данные. Каждая сторона подписывает отдельно; оплата доступна заказчику после всех необходимых подписей.',
    'Қол қоймас бұрын тараптарды, тауарды, мекенжайларды, жалпы бағаны және жеткізу шарттарын тексеріңіз. Міндетті өрістерді толтырып, дұрыс деректерді растаңыз. Әр тарап бөлек қол қояды; барлық қажетті қолдардан кейін тапсырыс беруші төлей алады.',
  ],
  paymentTitle: ['Confirm payment', 'Подтвердите оплату', 'Төлемді растаңыз'],
  payment: [
    'After all signatures, open payment and check the total and currency. This checkout simulates payment: use test details, not real card or bank details. Confirming records payment in the app and lets the factory start fulfillment.',
    'После всех подписей откройте оплату и проверьте сумму и валюту. Здесь оплата имитируется: используйте тестовые, а не реальные банковские данные. Подтверждение отмечает оплату в приложении и позволяет заводу начать исполнение.',
    'Барлық қолдардан кейін төлемді ашып, соманы және валютаны тексеріңіз. Мұнда төлем үлгіленеді: нақты банк деректерінің орнына сынақ деректерін пайдаланыңыз. Растау қолданбада төлемді белгілеп, зауытқа орындауды бастауға мүмкіндік береді.',
  ],
  fulfillTitle: [
    'Start fulfilling the order',
    'Начните исполнение заказа',
    'Тапсырысты орындауды бастаңыз',
  ],
  fulfill: [
    'Once payment is confirmed, the factory can start fulfillment. Use Start when you begin preparing the order; this records the handover to the fulfillment stage and allows the carrier to update delivery progress.',
    'После подтверждения оплаты завод может начать исполнение. Нажмите «Начать», когда приступаете к подготовке заказа: это меняет этап и позволяет перевозчику обновлять ход доставки.',
    'Төлем расталған соң зауыт орындауды бастай алады. Дайындауға кіріскенде «Бастау» түймесін басыңыз: кезең өзгереді және тасымалдаушы жеткізу барысын жаңарта алады.',
  ],
  transitTitle: ['Update delivery progress', 'Обновите ход доставки', 'Жеткізу барысын жаңартыңыз'],
  transit: [
    'After the factory starts fulfillment, mark the shipment in progress when delivery begins. This tells the customer the order is moving; the customer confirms completion after receiving and checking the goods.',
    'После начала исполнения заводом отметьте отправление в пути, когда начнётся доставка. Заказчик увидит движение заказа и подтвердит завершение после получения и проверки товара.',
    'Зауыт орындауды бастағаннан кейін жеткізу басталғанда жөнелтілімді жолда деп белгілеңіз. Тапсырыс беруші қозғалысты көріп, тауарды алған және тексерген соң аяқталуын растайды.',
  ],
  acceptTitle: [
    'Check delivery and accept completion',
    'Проверьте доставку и завершите заказ',
    'Жеткізуді тексеріп, тапсырысты аяқтаңыз',
  ],
  accept: [
    'Accept completion only after receiving and checking the goods. This marks the order completed. You can then rate the partners based on this order.',
    'Подтверждайте завершение только после получения и проверки товара. Заказ станет завершённым. После этого можно оценить партнёров по результатам заказа.',
    'Тауарды алған және тексерген соң ғана аяқталуын растаңыз. Тапсырыс аяқталған болып белгіленеді. Содан кейін осы тапсырыс бойынша серіктестерді бағалай аласыз.',
  ],
  workflow: [
    'Follow the next-step explanation on each order. Actions become available as the required signatures, payment and delivery stages are completed.',
    'Следуйте подсказке у каждого заказа. Действия становятся доступны по мере подписания, оплаты и прохождения этапов доставки.',
    'Әр тапсырыстың келесі қадам нұсқауын орындаңыз. Әрекеттер қол қою, төлем және жеткізу кезеңдері орындалған сайын қолжетімді болады.',
  ],
  waitingSignatures: [
    'Waiting for the remaining contract signatures. Check the signatures column to see which party still needs to sign.',
    'Ожидаются оставшиеся подписи. В столбце подписей видно, какая сторона ещё должна подписать договор.',
    'Қалған қолдар күтілуде. Қолдар бағанынан қай тараптың әлі қол қоюы керегін қараңыз.',
  ],
  waitingPayment: [
    'Waiting for the customer to confirm payment. Fulfillment starts after payment is recorded.',
    'Ожидается подтверждение оплаты заказчиком. Исполнение начинается после регистрации оплаты.',
    'Тапсырыс берушінің төлемді растауы күтілуде. Орындау төлем тіркелген соң басталады.',
  ],
  waitingFactory: [
    'Payment is recorded. The factory now needs to start fulfillment.',
    'Оплата зарегистрирована. Теперь завод должен начать исполнение заказа.',
    'Төлем тіркелді. Енді зауыт тапсырысты орындауды бастауы керек.',
  ],
  waitingCarrier: [
    'The factory has started fulfillment. The carrier updates the order when delivery begins.',
    'Завод начал исполнение. Перевозчик обновит статус, когда начнётся доставка.',
    'Зауыт орындауды бастады. Жеткізу басталғанда тасымалдаушы күйді жаңартады.',
  ],
  waitingCustomer: [
    'Delivery is in progress. The customer confirms completion after receiving and checking the goods.',
    'Доставка выполняется. Заказчик подтвердит завершение после получения и проверки товара.',
    'Жеткізу орындалуда. Тапсырыс беруші тауарды алған және тексерген соң аяқталуын растайды.',
  ],
  completed: [
    'This order is completed. Keep its reference for your records.',
    'Заказ завершён. Сохраните его номер для своих записей.',
    'Тапсырыс аяқталды. Нөмірін жазбаларыңызда сақтаңыз.',
  ],
  unavailable: [
    'No next action is available for this order in its current state. Check its status and any error message before continuing.',
    'В текущем состоянии для заказа нет следующего действия. Перед продолжением проверьте статус и сообщения об ошибках.',
    'Тапсырыстың қазіргі күйінде келесі әрекет жоқ. Жалғастырмас бұрын күйін және қате хабарларын тексеріңіз.',
  ],
} as const;

export type GuidanceKey = keyof typeof guidanceCopy;
export type GuidedRole = 'customer' | 'factory' | 'logist';

export function guidanceText(locale: Locale, key: GuidanceKey) {
  return guidanceCopy[key][locale === 'ru' ? 1 : locale === 'kk' ? 2 : 0];
}

export const firstSteps: Record<
  GuidedRole,
  { title: GuidanceKey; hint: GuidanceKey; view: string }[]
> = {
  customer: [
    { title: 'requestTitle', hint: 'request', view: 'requests' },
    { title: 'proposalTitle', hint: 'proposals', view: 'requests' },
    { title: 'signTitle', hint: 'sign', view: 'workflow' },
    { title: 'paymentTitle', hint: 'payment', view: 'workflow' },
    { title: 'acceptTitle', hint: 'accept', view: 'workflow' },
  ],
  factory: [
    { title: 'inventoryTitle', hint: 'inventory', view: 'inventory' },
    { title: 'bidTitle', hint: 'bid', view: 'requests' },
    { title: 'signTitle', hint: 'sign', view: 'workflow' },
    { title: 'fulfillTitle', hint: 'fulfill', view: 'workflow' },
  ],
  logist: [
    { title: 'serviceTitle', hint: 'service', view: 'offers' },
    { title: 'quoteTitle', hint: 'quote', view: 'quotes' },
    { title: 'signTitle', hint: 'sign', view: 'workflow' },
    { title: 'transitTitle', hint: 'transit', view: 'workflow' },
  ],
};

export const sectionHints: Record<GuidedRole, Record<string, GuidanceKey>> = {
  customer: { home: 'customerRole', requests: 'requests', workflow: 'workflow' },
  factory: {
    home: 'factoryRole',
    requests: 'bid',
    bids: 'bids',
    inventory: 'inventory',
    workflow: 'workflow',
  },
  logist: { home: 'logistRole', quotes: 'quote', offers: 'service', workflow: 'workflow' },
};
