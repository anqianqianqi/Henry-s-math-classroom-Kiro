/**
 * Shop and inventory.
 *
 * Item titles and descriptions are author-written and stay as typed.
 */

export const shop = {
  'shop.title': { en: 'Shop', zh: '商店' },

  // Shown when region filtering removed something. One key with a placeholder
  // rather than joined fragments: the count sits mid-sentence in English and
  // before a measure word in Chinese, and no amount of joining in JSX produces
  // both word orders.
  'shop.regionHidden': {
    en: '{count} item(s) are hidden because they cannot be posted to your region.',
    zh: '有 {count} 件商品无法寄送至您所在的地区，已隐藏。',
  },
  'shop.regionChange': { en: 'Change region', zh: '更改地区' },
  'shop.balance': { en: 'Balance', zh: '余额' },
  'shop.points': { en: 'points', zh: '积分' },
  'shop.buy': { en: 'Buy', zh: '购买' },
  'shop.owned': { en: 'Owned', zh: '已拥有' },
  'shop.soldOut': { en: 'Sold out', zh: '已售罄' },
  'shop.notEnoughPoints': { en: 'Not enough points', zh: '积分不足' },
  'shop.confirmPurchase': { en: 'Confirm purchase', zh: '确认购买' },
  'shop.purchased': { en: 'Purchased', zh: '购买成功' },
  'shop.empty': { en: 'Nothing in the shop yet', zh: '商店暂时没有商品' },
  'shop.myItems': { en: 'My Items', zh: '我的物品' },
  'shop.history': { en: 'Purchase History', zh: '购买记录' },
  'shop.cost': { en: 'Cost', zh: '价格' },
  'shop.quantity': { en: 'Quantity', zh: '数量' },
  'shop.addItem': { en: 'Add Item', zh: '添加商品' },
  'shop.itemName': { en: 'Item name', zh: '商品名称' },
  'shop.itemDescription': { en: 'Description', zh: '描述' },

  // ── Page chrome ──────────────────────────────────────────
  'shop.pageTitle': { en: 'Points Shop', zh: '积分商店' },
  'shop.loading': { en: 'Loading shop…', zh: '正在加载商店…' },
  'shop.spendableBalance': { en: 'Your Spendable Balance', zh: '您的可用积分' },
  'shop.availableRewards': { en: 'Available Rewards', zh: '可兑换的奖励' },
  'shop.noRewards': { en: 'No rewards available yet.', zh: '暂时还没有奖励。' },
  'shop.checkBack': { en: 'Check back soon!', zh: '过阵子再来看看吧！' },
  'shop.noItemsInCategory': { en: 'No items in this category yet.', zh: '这个分类暂时没有商品。' },
  'shop.details': { en: 'Details', zh: '详情' },
  'shop.browse': { en: 'Browse', zh: '浏览' },
  'shop.soldOutBadge': { en: 'Sold Out', zh: '已售罄' },
  'shop.ownedBadge': { en: 'Owned', zh: '已拥有' },

  // ── Categories ───────────────────────────────────────────
  'shop.catFood': { en: 'Food', zh: '食物' },
  'shop.catAccessory': { en: 'Accessory', zh: '配饰' },
  'shop.catNewPet': { en: 'New Pet', zh: '新宠物' },
  'shop.catBlindBox': { en: 'Blind Box', zh: '盲盒' },
  'shop.catPhysical': { en: 'Physical', zh: '实物' },
  'shop.catPhysicalPrize': { en: 'Physical Prize', zh: '实物奖品' },
  'shop.catPhysicalBlindBox': { en: 'Physical Blind Box', zh: '实物盲盒' },

  // ── Browse tiles ─────────────────────────────────────────
  'shop.musicTracks': { en: 'Music Tracks', zh: '音乐曲目' },
  'shop.browseMusic': { en: 'Browse Music', zh: '浏览音乐' },
  'shop.roomBackgrounds': { en: 'Room Backgrounds', zh: '房间背景' },
  'shop.browseRooms': { en: 'Browse Rooms', zh: '浏览房间' },
  'shop.roomsBlurb': {
    en: 'Unlock a themed room for your pet. Tap to browse all styles.',
    zh: '为您的宠物解锁主题房间，点击浏览全部风格。',
  },
  'shop.bookCovers': { en: 'Book Covers', zh: '书封面' },
  'shop.browseCovers': { en: 'Browse Covers', zh: '浏览封面' },

  // Challenge rooms and their matching books. Separate folders rather than one,
  // mirroring the Room Backgrounds / Book Covers split — a student buys the two
  // for different reasons.
  'shop.challengeRooms': { en: 'Challenge Rooms', zh: '挑战题房间' },
  'shop.browseChallengeRooms': { en: 'Browse Rooms', zh: '浏览房间' },
  'shop.challengeRoomsBlurb': {
    en: 'The room your challenge book opens in. Tap to browse all worlds.',
    zh: '挑战题书本所在的房间场景，点击浏览全部主题。',
  },
  'shop.challengeBooks': { en: 'Challenge Books', zh: '挑战题书本' },
  'shop.browseChallengeBooks': { en: 'Browse Books', zh: '浏览书本' },
  'shop.challengeBooksBlurb': {
    en: 'Cover and pages for the book on your desk. Tap to browse all sets.',
    zh: '书桌上书本的封面与内页，点击浏览全部套装。',
  },
  'shop.zoomHint': {
    en: 'Click an image to zoom preview · Buy to unlock',
    zh: '点击图片放大预览 · 购买即可解锁',
  },
  'shop.animateHint': {
    en: 'Click an image to preview with animations · Buy to unlock',
    zh: '点击图片查看动画预览 · 购买即可解锁',
  },
  'shop.musicHint': {
    en: 'Preview a track · Buy to unlock it in your music player',
    zh: '试听曲目 · 购买后即可在音乐播放器中使用',
  },
  'shop.closePreview': { en: 'Close preview', zh: '关闭预览' },
  'shop.challengeTitlePreview': { en: 'Challenge Title Preview', zh: '挑战题标题预览' },
  'shop.openTheBook': { en: 'Open the Book', zh: '打开这本书' },

  // ── Redemption ───────────────────────────────────────────
  'shop.redeemed': { en: 'Redeemed!', zh: '兑换成功！' },
  'shop.redeemedBody': { en: "You've successfully redeemed {item}.", zh: '您已成功兑换 {item}。' },
  'shop.physicalNote': {
    en: "This is a physical item — there's nothing to download. Please ping Henry to arrange pickup or delivery of your prize!",
    zh: '这是实物奖品，没有可下载的内容。请联系 Henry 安排领取或寄送！',
  },
  'shop.physicalNoteShort': {
    en: 'This is a physical item — please ping Henry to arrange pickup or delivery!',
    zh: '这是实物奖品，请联系 Henry 安排领取或寄送！',
  },
  'shop.gotIt': { en: 'Got it!', zh: '知道了！' },
  'shop.foodQueued': { en: 'Added to food queue!', zh: '已加入喂食队列！' },
  'shop.historyTitle': { en: 'Your Redemption History', zh: '您的兑换记录' },
  'shop.noHistory': { en: "You haven't redeemed anything yet.", zh: '您还没有兑换过任何东西。' },
  'shop.refunded': { en: 'Refunded', zh: '已退款' },
  'shop.viewPrize': { en: 'View Prize', zh: '查看奖品' },

  // ── Blind box ────────────────────────────────────────────
  'shop.prizesUnlocked': { en: '{count} prizes unlocked! 🎉', zh: '解锁了 {count} 件奖品！🎉' },
  'shop.gotItPrize': { en: 'You got it! 🎉', zh: '到手了！🎉' },
  'shop.downloadAll': { en: 'Download All ({count})', zh: '全部下载（{count}）' },
  'shop.download': { en: 'Download', zh: '下载' },
  'shop.shaking': { en: 'Shaking the box…', zh: '正在摇盲盒…' },
  'shop.opening': { en: 'Opening…', zh: '正在打开…' },
  'shop.yourPrizes': { en: 'Your {count} prizes', zh: '您的 {count} 件奖品' },
  'shop.yourPrize': { en: 'Your prize', zh: '您的奖品' },
  'shop.tooCostly': { en: 'Too costly', zh: '积分不够' },
  'shop.taBalance': { en: 'TA points available', zh: '可用助教积分' },
  'shop.taPoints': { en: 'TA points', zh: '助教积分' },
  'shop.challengePoints': { en: 'Challenge points', zh: '挑战积分' },
} as const
