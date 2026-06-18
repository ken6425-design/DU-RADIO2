/**
 * DU電台 —— 後端伺服器（雲端 / 本機通用）
 * - 一個網址：首頁分流「我要點歌 / 我是放送端」
 * - 放送端免密碼；候播清單人人可拖曳排序、插播、移除（即時同步）
 * - 沒歌時「自動點歌」：從內建約 982 首（中/韓/英）隨機挑，即時搜尋當下有效影片播放
 * 啟動： node server.js   需求： Node.js 18+
 */
const http = require('http');
const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');
const os = require('os');

const PORT = process.env.PORT || 3000;
const YT_API_KEY = process.env.YT_API_KEY || '';   // 選填：填了搜尋更穩定
const MAX_HISTORY = 200;

/* ===== 內建自動點歌歌單（歌名，由伺服器即時搜尋當下有效影片；中/韓/英約均分） ===== */
const DJ_SONGS = ["周杰倫 晴天", "周杰倫 七里香", "周杰倫 稻香", "周杰倫 告白氣球", "周杰倫 青花瓷", "周杰倫 簡單愛", "周杰倫 擱淺", "周杰倫 髮如雪", "周杰倫 東風破", "周杰倫 夜曲", "周杰倫 安靜", "周杰倫 蒲公英的約定", "周杰倫 說好不哭", "周杰倫 聽媽媽的話", "周杰倫 龍捲風", "周杰倫 楓", "周杰倫 一路向北", "周杰倫 菊花台", "周杰倫 你聽得到", "周杰倫 算什麼男人", "五月天 突然好想你", "五月天 溫柔", "五月天 倔強", "五月天 知足", "五月天 戀愛ing", "五月天 後來的我們", "五月天 你不是真正的快樂", "五月天 志明與春嬌", "五月天 傷心的人別聽慢歌", "五月天 洋蔥", "五月天 私奔到月球", "五月天 成名在望", "五月天 頑固", "五月天 離開地球表面", "五月天 憨人", "五月天 終結孤單", "五月天 乾杯", "五月天 如煙", "林俊傑 江南", "林俊傑 修煉愛情", "林俊傑 她說", "林俊傑 醉赤壁", "林俊傑 可惜沒如果", "林俊傑 一千年以後", "林俊傑 曹操", "林俊傑 背對背擁抱", "林俊傑 不為誰而作的歌", "林俊傑 學不會", "林俊傑 美人魚", "林俊傑 當你", "林俊傑 黑夜問白天", "林俊傑 偉大的渺小", "林俊傑 只要有你的地方", "鄧紫棋 泡沫", "鄧紫棋 光年之外", "鄧紫棋 喜歡你", "鄧紫棋 倒數", "鄧紫棋 句號", "鄧紫棋 後會無期", "鄧紫棋 來自天堂的魔鬼", "鄧紫棋 存在的意義", "鄧紫棋 差不多姑娘", "鄧紫棋 超能力", "鄧紫棋 很久", "鄧紫棋 再見", "陳奕迅 浮誇", "陳奕迅 十年", "陳奕迅 富士山下", "陳奕迅 好久不見", "陳奕迅 陪你度過漫長歲月", "陳奕迅 愛情轉移", "陳奕迅 紅玫瑰", "陳奕迅 穩穩的幸福", "陳奕迅 聖誕結", "陳奕迅 明年今日", "陳奕迅 人來人往", "陳奕迅 於心有愧", "陳奕迅 我們", "陳奕迅 크리스", "張學友 吻別", "張學友 一千個傷心的理由", "張學友 心如刀割", "張學友 她來聽我的演唱會", "張學友 慢慢", "張學友 只想一生跟你走", "張學友 每天愛你多一些", "張學友 頭髮亂了", "王力宏 你不知道的事", "王力宏 唯一", "王力宏 大城小愛", "王力宏 需要人陪", "王力宏 改變自己", "王力宏 心跳", "王力宏 落葉歸根", "王力宏 依然愛你", "王力宏 龍的傳人", "王力宏 花田錯", "蔡依林 日不落", "蔡依林 舞孃", "蔡依林 倒帶", "蔡依林 說愛你", "蔡依林 我呸", "蔡依林 大藝術家", "蔡依林 看我七十二變", "蔡依林 花蝴蝶", "蔡依林 美人計", "蔡依林 Play我呸", "蔡依林 怪美的", "田馥甄 小幸運", "田馥甄 魔鬼中的天使", "田馥甄 你就不要想起我", "田馥甄 寂寞寂寞就好", "田馥甄 渺小", "田馥甄 念念有詞", "田馥甄 日常", "田馥甄 請說", "田馥甄 還是要相信愛情", "S.H.E Super Star", "S.H.E 不想長大", "S.H.E 安全感", "S.H.E 戀人未滿", "S.H.E 中國話", "S.H.E 候鳥", "S.H.E 你曾是少年", "S.H.E 怎麼辦", "孫燕姿 遇見", "孫燕姿 雨天", "孫燕姿 天黑黑", "孫燕姿 綠光", "孫燕姿 我懷念的", "孫燕姿 克卜勒", "孫燕姿 逆光", "孫燕姿 開始懂了", "孫燕姿 風箏", "孫燕姿 學會", "梁靜茹 勇氣", "梁靜茹 寧夏", "梁靜茹 可惜不是你", "梁靜茹 情歌", "梁靜茹 分手快樂", "梁靜茹 崇拜", "梁靜茹 會呼吸的痛", "梁靜茹 小手拉大手", "梁靜茹 暖暖", "梁靜茹 愛你不是兩三天", "張惠妹 聽海", "張惠妹 我可以抱你嗎", "張惠妹 記得", "張惠妹 你是愛我的", "張惠妹 三天三夜", "張惠妹 哭不出來", "張惠妹 原來你什麼都不要", "張惠妹 掉了", "張惠妹 BAD BOY", "張惠妹 身後", "林宥嘉 說謊", "林宥嘉 浪費", "林宥嘉 你是我的眼", "林宥嘉 傻子", "林宥嘉 想自由", "林宥嘉 成全", "林宥嘉 秋擺", "林宥嘉 兜圈", "林宥嘉 現在進行式", "林宥嘉 殘酷月光", "蕭敬騰 王妃", "蕭敬騰 只能想念你", "蕭敬騰 新不了情", "蕭敬騰 怎麼說我不愛你", "蕭敬騰 疼愛", "蕭敬騰 以愛之名", "蕭敬騰 零負擔", "蕭敬騰 讓我為你唱情歌", "告五人 愛人錯過", "告五人 唯一", "告五人 對你說", "告五人 在這座城市遺失了你", "告五人 披星戴月的想你", "告五人 你要不要吃哈密瓜", "告五人 迷霧之中", "茄子蛋 浪流連", "茄子蛋 這款自作多情", "茄子蛋 愛情你比我想的閣較偉大", "茄子蛋 日頭", "茄子蛋 我們以後要結婚", "茄子蛋 卡通", "落日飛車 My Jinji", "落日飛車 Slow", "落日飛車 Burgundy Red", "落日飛車 I Know You Know I Love You", "落日飛車 Vanilla Villa", "盧廣仲 刻在我心底的名字", "盧廣仲 魚仔", "盧廣仲 100種生活", "盧廣仲 幾分之幾", "盧廣仲 早安晨之美", "盧廣仲 慢靈魂", "盧廣仲 明仔載", "韋禮安 如果可以", "韋禮安 還是會", "韋禮安 在你身邊", "韋禮安 有沒有", "韋禮安 一個人失憶", "韋禮安 sorry youth", "韋禮安 聽你聽過的歌", "李榮浩 模特", "李榮浩 年少有為", "李榮浩 李白", "李榮浩 老街", "李榮浩 麻雀", "李榮浩 戒菸", "李榮浩 不將就", "李榮浩 念念不忘", "李榮浩 喜劇之王", "周興哲 以後別做朋友", "周興哲 你 好不好", "周興哲 怎麼了", "周興哲 永不失聯的愛", "周興哲 終於了解自由", "周興哲 說了再見以後", "周興哲 沒有人像你", "楊丞琳 帶我走", "楊丞琳 曖昧", "楊丞琳 慶祝", "楊丞琳 左邊", "楊丞琳 過敏", "楊丞琳 匿名的好友", "楊丞琳 可惜不是你", "周深 大魚", "周深 光亮", "周深 起風了", "周深 化身孤島的鯨", "周深 念", "周深 燈火裡的中國", "周深 安和橋", "毛不易 消愁", "毛不易 像我這樣的人", "毛不易 一程山路", "毛不易 感觉自己是巨星", "毛不易 不染", "毛不易 東北民謠", "毛不易 牧馬城市", "薛之謙 演員", "薛之謙 醜八怪", "薛之謙 你還要我怎樣", "薛之謙 剛剛好", "薛之謙 認真的雪", "薛之謙 紳士", "薛之謙 違背的諾言", "薛之謙 方圓幾里", "華晨宇 煙火裡的塵埃", "華晨宇 齊天", "華晨宇 好想愛這個世界啊", "華晨宇 我們", "華晨宇 卡西莫多的禮物", "華晨宇 降臨", "陳綺貞 旅行的意義", "陳綺貞 魚", "陳綺貞 小步舞曲", "陳綺貞 下個星期去英國", "陳綺貞 流浪者之歌", "陳綺貞 太陽", "陳綺貞 失敗者的飛翔", "蘇打綠 小情歌", "蘇打綠 我好想你", "蘇打綠 無與倫比的美麗", "蘇打綠 你在煩惱什麼", "蘇打綠 故事", "蘇打綠 頻率", "蘇打綠 遲到千年", "蘇打綠 當我們一起走過", "草東沒有派對 大風吹", "草東沒有派對 山海", "草東沒有派對 爛泥", "草東沒有派對 勇敢的人", "草東沒有派對 情歌", "草東沒有派對 醜時鐘", "任賢齊 對面的女孩看過來", "任賢齊 心太軟", "任賢齊 傷心太平洋", "任賢齊 天涯", "任賢齊 春天花會開", "任賢齊 傷心1999", "任賢齊 再出發", "伍佰 突然的自我", "伍佰 痛哭的人", "伍佰 挪威的森林", "伍佰 last dance", "伍佰 你是我的花朵", "伍佰 浪人情歌", "伍佰 白鴿", "伍佰 愛你一萬年", "王菲 紅豆", "王菲 我願意", "王菲 容易受傷的女人", "王菲 匆匆那年", "王菲 傳奇", "王菲 棋子", "王菲 約定", "王菲 你快樂所以我快樂", "周華健 朋友", "周華健 花心", "周華健 風雨無阻", "周華健 讓我歡喜讓我憂", "周華健 親親我的寶貝", "周華健 刀劍如夢", "周華健 其實不想走", "動力火車 當", "動力火車 忠孝東路走九遍", "動力火車 再會啦心愛的無緣的人", "動力火車 彩虹", "動力火車 明天的明天的明天", "動力火車 除了愛你還能愛誰", "信樂團 死了都要愛", "信樂團 離歌", "信樂團 One Night in 北京", "信樂團 海闊天空", "信樂團 假如", "信樂團 天高地厚", "飛兒樂團 我們的愛", "飛兒樂團 Lydia", "飛兒樂團 千年之戀", "飛兒樂團 月牙灣", "飛兒樂團 你的微笑", "戴佩妮 怎樣", "戴佩妮 你要的愛", "戴佩妮 街角的祝福", "戴佩妮 賊", "戴佩妮 防空洞", "戴佩妮 一個人的行李", "徐佳瑩 身騎白馬", "徐佳瑩 失落沙洲", "徐佳瑩 你敢不敢", "徐佳瑩 尋人啟事", "徐佳瑩 心裡學", "徐佳瑩 言不由衷", "A-Lin 給我一個理由忘記", "A-Lin 有一種悲傷", "A-Lin 以前以後", "A-Lin 罪人", "A-Lin 酒矸倘賣無", "A-Lin 摯友", "八三夭 想見你想見你想見你", "八三夭 拥抱你", "八三夭 一日三餐", "八三夭 大人中", "八三夭 最後的最後", "滅火器 島嶼天光", "滅火器 晚安台灣", "滅火器 長途夜車", "滅火器 繼續向前行", "老王樂隊 我還年輕 我還年輕", "老王樂隊 吾日三省吾身", "老王樂隊 穩定生活多美好 三年五年高普考", "老王樂隊 學校沒有教的事", "房東的貓 雲煙成雨", "房東的貓 美好事物", "房東的貓 下一站茶山劉", "房東的貓 新青年", "陳粒 歷歷萬鄉", "陳粒 易燃易爆炸", "陳粒 光", "陳粒 奇妙能力歌", "陳粒 虛擬", "BTS Dynamite", "BTS Butter", "BTS Boy With Luv", "BTS DNA", "BTS Fake Love", "BTS Spring Day", "BTS Permission to Dance", "BTS IDOL", "BTS Mic Drop", "BTS Blood Sweat Tears", "BTS Save Me", "BTS Not Today", "BTS Life Goes On", "BTS Black Swan", "BTS ON", "BTS FIRE", "BLACKPINK DDU-DU DDU-DU", "BLACKPINK Kill This Love", "BLACKPINK How You Like That", "BLACKPINK Pink Venom", "BLACKPINK Lovesick Girls", "BLACKPINK Shut Down", "BLACKPINK As If Its Your Last", "BLACKPINK Playing With Fire", "BLACKPINK Boombayah", "BLACKPINK Whistle", "BLACKPINK Forever Young", "BLACKPINK Stay", "TWICE What Is Love", "TWICE Fancy", "TWICE Feel Special", "TWICE TT", "TWICE Cheer Up", "TWICE The Feels", "TWICE Likey", "TWICE Yes or Yes", "TWICE Signal", "TWICE Heart Shaker", "TWICE More and More", "TWICE Talk That Talk", "TWICE Set Me Free", "NewJeans Hype Boy", "NewJeans Attention", "NewJeans Ditto", "NewJeans OMG", "NewJeans Super Shy", "NewJeans ETA", "NewJeans Cookie", "NewJeans Get Up", "NewJeans New Jeans", "IVE Love Dive", "IVE After Like", "IVE Eleven", "IVE I AM", "IVE Kitsch", "IVE Baddie", "IVE Either Way", "LE SSERAFIM Antifragile", "LE SSERAFIM Fearless", "LE SSERAFIM Unforgiven", "LE SSERAFIM Eve Psyche", "LE SSERAFIM Perfect Night", "LE SSERAFIM Smart", "aespa Next Level", "aespa Savage", "aespa Spicy", "aespa Black Mamba", "aespa Drama", "aespa Girls", "aespa Supernova", "aespa Armageddon", "GIDLE Tomboy", "GIDLE Nxde", "GIDLE Queencard", "GIDLE Hwaa", "GIDLE Lion", "GIDLE Oh My God", "GIDLE Latata", "GIDLE Super Lady", "Red Velvet Psycho", "Red Velvet Bad Boy", "Red Velvet Red Flavor", "Red Velvet Peek-A-Boo", "Red Velvet Russian Roulette", "Red Velvet Feel My Rhythm", "Red Velvet Ice Cream Cake", "Red Velvet Power Up", "Red Velvet Birthday", "EXO Love Shot", "EXO Monster", "EXO Growl", "EXO Call Me Baby", "EXO Tempo", "EXO Ko Ko Bop", "EXO The Eve", "EXO Power", "BIGBANG Bang Bang Bang", "BIGBANG Fantastic Baby", "BIGBANG Loser", "BIGBANG Haru Haru", "BIGBANG Last Dance", "BIGBANG Flower Road", "BIGBANG Lies", "BIGBANG Blue", "BIGBANG Bad Boy", "Stray Kids God Menu", "Stray Kids MANIAC", "Stray Kids S-Class", "Stray Kids Back Door", "Stray Kids Thunderous", "Stray Kids Case 143", "Stray Kids Lalalala", "Stray Kids Chk Chk Boom", "SEVENTEEN Very Nice", "SEVENTEEN Super", "SEVENTEEN God of Music", "SEVENTEEN HOT", "SEVENTEEN Dont Wanna Cry", "SEVENTEEN Left and Right", "SEVENTEEN Rock With You", "SEVENTEEN Maestro", "SEVENTEEN Pretty U", "ITZY Wannabe", "ITZY Dalla Dalla", "ITZY LOCO", "ITZY Not Shy", "ITZY In the Morning", "ITZY Cake", "ITZY Born to Be", "ITZY Sneakers", "TXT Sugar Rush Ride", "TXT 0X1 LOVESONG", "TXT Crown", "TXT Good Boy Gone Bad", "TXT Blue Hour", "TXT Sugar Rush", "TXT Deja Vu", "NCT 127 Kick It", "NCT 127 Cherry Bomb", "NCT 127 Sticker", "NCT 127 Favorite", "NCT 127 2 Baddies", "NCT 127 Fact Check", "NCT Dream Hot Sauce", "NCT Dream Glitch Mode", "NCT Dream Candy", "NCT Dream Hello Future", "NCT Dream Ridin", "NCT Dream Beatbox", "NCT Dream Smoothie", "IU Love wins all", "IU eight", "IU Celebrity", "IU Lilac", "IU Blueming", "IU Through the Night", "IU Palette", "IU Good Day", "IU Bbibbi", "IU Love Poem", "IU Strawberry Moon", "PSY Gangnam Style", "PSY Gentleman", "PSY Daddy", "PSY That That", "PSY New Face", "PSY Hangover", "Girls Generation Gee", "Girls Generation Into the New World", "Girls Generation The Boys", "Girls Generation I Got a Boy", "Girls Generation Lion Heart", "Girls Generation Mr Mr", "Girls Generation FOREVER 1", "Girls Generation Genie", "SHINee Ring Ding Dong", "SHINee View", "SHINee Sherlock", "SHINee Lucifer", "SHINee Replay", "SHINee Dont Call Me", "SHINee Married to the Music", "Super Junior Sorry Sorry", "Super Junior Mr Simple", "Super Junior Bonamana", "Super Junior Devil", "Super Junior Black Suit", "Super Junior Mamacita", "MAMAMOO Hip", "MAMAMOO Egotistic", "MAMAMOO Starry Night", "MAMAMOO Decalcomanie", "MAMAMOO Gogobebe", "MAMAMOO Dingga", "MAMAMOO Um Oh Ah Yeh", "GFRIEND Time for the Moon Night", "GFRIEND Rough", "GFRIEND Mago", "GFRIEND Apple", "GFRIEND Navillera", "GFRIEND Me Gustas Tu", "GFRIEND Fingertip", "Apink Im So Sick", "Apink Eung Eung", "Apink Dumhdurum", "Apink NoNoNo", "Apink Mr Chu", "Apink Luv", "Apink Five", "Sunmi Gashina", "Sunmi Siren", "Sunmi Heroine", "Sunmi Tail", "Sunmi You Cant Sit With Us", "Sunmi Pporappippam", "Hyuna Bubble Pop", "Hyuna Red", "Hyuna How Is This", "Hyuna Lip and Hip", "Hyuna Ice Cream", "AKMU How People Move", "AKMU Dinosaur", "AKMU How Can I Love the Heartbreak", "AKMU Love Lee", "AKMU Dont Cross Your Legs", "BOL4 Some", "BOL4 Travel", "BOL4 Galaxy", "BOL4 Bom", "BOL4 Workaholic", "BOL4 Leo", "DAY6 You Were Beautiful", "DAY6 Time of Our Life", "DAY6 Congratulations", "DAY6 Zombie", "DAY6 I Loved You", "DAY6 Shoot Me", "ENHYPEN Bite Me", "ENHYPEN Future Perfect", "ENHYPEN Drunk-Dazed", "ENHYPEN Given-Taken", "ENHYPEN Polaroid Love", "ENHYPEN Sweet Venom", "ATEEZ Wonderland", "ATEEZ Guerrilla", "ATEEZ Bouncy", "ATEEZ Crazy Form", "ATEEZ Say My Name", "ATEEZ Wave", "NMIXX Love Me Like This", "NMIXX Party O Clock", "NMIXX Dice", "NMIXX OO-LI", "NMIXX Soñar", "NMIXX Dash", "Taeyang Eyes Nose Lips", "Taeyang Wedding Dress", "Taeyang Only Look at Me", "Taeyang 1AM", "Taeyeon INVU", "Taeyeon I", "Taeyeon Four Seasons", "Taeyeon 11:11", "Taeyeon Weekend", "Taeyeon Fine", "Taeyeon Gravity", "Taeyeon Spark", "ZICO Any Song", "ZICO Artist", "ZICO New Thing", "ZICO Spoiled", "ZICO Okey Dokey", "ROSE On The Ground", "ROSE Gone", "ROSE APT", "ROSE Number One Girl", "LISA Lalisa", "LISA Money", "LISA Rockstar", "LISA New Woman", "Jennie Solo", "Jennie You and Me", "Jennie Mantra", "Ed Sheeran Shape of You", "Ed Sheeran Perfect", "Ed Sheeran Photograph", "Ed Sheeran Thinking Out Loud", "Ed Sheeran Castle on the Hill", "Ed Sheeran Galway Girl", "Ed Sheeran Bad Habits", "Ed Sheeran Shivers", "Ed Sheeran The A Team", "Ed Sheeran Happier", "Ed Sheeran Lego House", "Adele Hello", "Adele Rolling in the Deep", "Adele Someone Like You", "Adele Easy On Me", "Adele Set Fire to the Rain", "Adele When We Were Young", "Adele Skyfall", "Adele Send My Love", "Adele Chasing Pavements", "Bruno Mars Uptown Funk", "Bruno Mars 24K Magic", "Bruno Mars Just the Way You Are", "Bruno Mars Grenade", "Bruno Mars Thats What I Like", "Bruno Mars Locked Out of Heaven", "Bruno Mars When I Was Your Man", "Bruno Mars Treasure", "Bruno Mars The Lazy Song", "Maroon 5 Sugar", "Maroon 5 Memories", "Maroon 5 Girls Like You", "Maroon 5 Payphone", "Maroon 5 Maps", "Maroon 5 Animals", "Maroon 5 This Love", "Maroon 5 She Will Be Loved", "Maroon 5 Moves Like Jagger", "Maroon 5 One More Night", "Coldplay Yellow", "Coldplay Viva la Vida", "Coldplay The Scientist", "Coldplay Hymn for the Weekend", "Coldplay Fix You", "Coldplay Paradise", "Coldplay Clocks", "Coldplay Something Just Like This", "Coldplay A Sky Full of Stars", "Coldplay Adventure of a Lifetime", "Coldplay My Universe", "Taylor Swift Blank Space", "Taylor Swift Shake It Off", "Taylor Swift Love Story", "Taylor Swift Anti-Hero", "Taylor Swift You Belong With Me", "Taylor Swift Cardigan", "Taylor Swift Cruel Summer", "Taylor Swift Bad Blood", "Taylor Swift Style", "Taylor Swift Wildest Dreams", "Taylor Swift Look What You Made Me Do", "Taylor Swift Lover", "Justin Bieber Sorry", "Justin Bieber Love Yourself", "Justin Bieber Baby", "Justin Bieber Peaches", "Justin Bieber What Do You Mean", "Justin Bieber Ghost", "Justin Bieber Stay", "Justin Bieber Intentions", "Justin Bieber Holy", "The Weeknd Blinding Lights", "The Weeknd Starboy", "The Weeknd Save Your Tears", "The Weeknd The Hills", "The Weeknd Cant Feel My Face", "The Weeknd Die For You", "The Weeknd Earned It", "The Weeknd I Feel It Coming", "Dua Lipa Levitating", "Dua Lipa New Rules", "Dua Lipa Dont Start Now", "Dua Lipa One Kiss", "Dua Lipa IDGAF", "Dua Lipa Physical", "Dua Lipa Houdini", "Dua Lipa Love Again", "Billie Eilish Bad Guy", "Billie Eilish Happier Than Ever", "Billie Eilish Lovely", "Billie Eilish Ocean Eyes", "Billie Eilish Bury a Friend", "Billie Eilish When the Partys Over", "Billie Eilish Therefore I Am", "Billie Eilish What Was I Made For", "Charlie Puth Attention", "Charlie Puth We Dont Talk Anymore", "Charlie Puth One Call Away", "Charlie Puth How Long", "Charlie Puth Light Switch", "Charlie Puth Marvin Gaye", "Katy Perry Roar", "Katy Perry Dark Horse", "Katy Perry Firework", "Katy Perry California Gurls", "Katy Perry Last Friday Night", "Katy Perry Hot N Cold", "Katy Perry Teenage Dream", "Katy Perry E.T.", "Lady Gaga Shallow", "Lady Gaga Poker Face", "Lady Gaga Bad Romance", "Lady Gaga Born This Way", "Lady Gaga Just Dance", "Lady Gaga Always Remember Us This Way", "Lady Gaga Rain on Me", "Lady Gaga Telephone", "Imagine Dragons Believer", "Imagine Dragons Thunder", "Imagine Dragons Demons", "Imagine Dragons Radioactive", "Imagine Dragons Whatever It Takes", "Imagine Dragons Natural", "Imagine Dragons Bones", "Imagine Dragons Enemy", "Imagine Dragons On Top of the World", "OneRepublic Counting Stars", "OneRepublic Apologize", "OneRepublic Secrets", "OneRepublic Good Life", "OneRepublic I Aint Worried", "OneRepublic Rescue Me", "OneRepublic If I Lose Myself", "Sia Chandelier", "Sia Cheap Thrills", "Sia Unstoppable", "Sia Elastic Heart", "Sia The Greatest", "Sia Snowman", "Sia Titanium", "The Chainsmokers Closer", "The Chainsmokers Something Just Like This", "The Chainsmokers Dont Let Me Down", "The Chainsmokers Paris", "The Chainsmokers Roses", "The Chainsmokers This Feeling", "Alan Walker Faded", "Alan Walker Alone", "Alan Walker On My Way", "Alan Walker Sing Me to Sleep", "Alan Walker Darkside", "Alan Walker The Spectre", "Shawn Mendes Stitches", "Shawn Mendes Treat You Better", "Shawn Mendes Theres Nothing Holdin Me Back", "Shawn Mendes Senorita", "Shawn Mendes In My Blood", "Shawn Mendes Mercy", "Shawn Mendes If I Cant Have You", "Camila Cabello Havana", "Camila Cabello Senorita", "Camila Cabello Never Be the Same", "Camila Cabello My Oh My", "Camila Cabello Dont Go Yet", "Camila Cabello Bam Bam", "Post Malone Circles", "Post Malone Sunflower", "Post Malone Rockstar", "Post Malone Congratulations", "Post Malone Better Now", "Post Malone Wow", "Post Malone I Fall Apart", "Harry Styles As It Was", "Harry Styles Watermelon Sugar", "Harry Styles Sign of the Times", "Harry Styles Adore You", "Harry Styles Late Night Talking", "Harry Styles Golden", "Olivia Rodrigo drivers license", "Olivia Rodrigo good 4 u", "Olivia Rodrigo vampire", "Olivia Rodrigo deja vu", "Olivia Rodrigo traitor", "Olivia Rodrigo brutal", "Olivia Rodrigo happier", "Lewis Capaldi Someone You Loved", "Lewis Capaldi Before You Go", "Lewis Capaldi Hold Me While You Wait", "Lewis Capaldi Forget Me", "Lewis Capaldi Bruises", "Miley Cyrus Flowers", "Miley Cyrus Wrecking Ball", "Miley Cyrus Party in the USA", "Miley Cyrus The Climb", "Miley Cyrus Malibu", "Miley Cyrus Midnight Sky", "Rihanna Diamonds", "Rihanna Umbrella", "Rihanna We Found Love", "Rihanna Work", "Rihanna Stay", "Rihanna Love on the Brain", "Rihanna Only Girl", "Rihanna Dont Stop the Music", "Beyonce Halo", "Beyonce Single Ladies", "Beyonce Crazy in Love", "Beyonce If I Were a Boy", "Beyonce Love on Top", "Beyonce Formation", "Beyonce Cuff It", "Eminem Lose Yourself", "Eminem Love the Way You Lie", "Eminem Without Me", "Eminem Not Afraid", "Eminem The Real Slim Shady", "Eminem Mockingbird", "Eminem Rap God", "Linkin Park In the End", "Linkin Park Numb", "Linkin Park Crawling", "Linkin Park What Ive Done", "Linkin Park Faint", "Linkin Park Somewhere I Belong", "Linkin Park Bleed It Out", "Linkin Park One Step Closer", "Queen Bohemian Rhapsody", "Queen We Will Rock You", "Queen We Are the Champions", "Queen Dont Stop Me Now", "Queen Somebody to Love", "Queen Under Pressure", "Queen Radio Ga Ga", "Queen Love of My Life", "Michael Jackson Billie Jean", "Michael Jackson Beat It", "Michael Jackson Thriller", "Michael Jackson Smooth Criminal", "Michael Jackson Bad", "Michael Jackson Black or White", "Michael Jackson Man in the Mirror", "Michael Jackson Earth Song", "Avicii Wake Me Up", "Avicii Levels", "Avicii Hey Brother", "Avicii The Nights", "Avicii Waiting for Love", "Avicii Without You", "Avicii Addicted to You", "Calvin Harris Summer", "Calvin Harris This Is What You Came For", "Calvin Harris Feel So Close", "Calvin Harris One Kiss", "Calvin Harris Outside", "Calvin Harris Blame", "Calvin Harris How Deep Is Your Love", "Marshmello Alone", "Marshmello Happier", "Marshmello Friends", "Marshmello Silence", "Marshmello Wolves", "Marshmello Here With Me", "Sam Smith Stay With Me", "Sam Smith Im Not the Only One", "Sam Smith Too Good at Goodbyes", "Sam Smith Unholy", "Sam Smith Lay Me Down", "Sam Smith Writings on the Wall", "Ariana Grande 7 rings", "Ariana Grande thank u next", "Ariana Grande No Tears Left to Cry", "Ariana Grande Into You", "Ariana Grande Problem", "Ariana Grande Side to Side", "Ariana Grande positions", "Ariana Grande breathin", "Ariana Grande One Last Time", "Selena Gomez Lose You to Love Me", "Selena Gomez Come Get It", "Selena Gomez Good for You", "Selena Gomez Wolves", "Selena Gomez Same Old Love", "Selena Gomez Calm Down", "Justin Timberlake Cant Stop the Feeling", "Justin Timberlake Mirrors", "Justin Timberlake Sexyback", "Justin Timberlake Cry Me a River", "Justin Timberlake Suit Tie", "Justin Timberlake What Goes Around", "John Legend All of Me", "John Legend Ordinary People", "John Legend Love Me Now", "John Legend Stay With You", "John Legend Conversations in the Dark", "Green Day Boulevard of Broken Dreams", "Green Day American Idiot", "Green Day Wake Me Up When September Ends", "Green Day 21 Guns", "Green Day Basket Case", "Green Day Holiday", "Bon Jovi Livin on a Prayer", "Bon Jovi Its My Life", "Bon Jovi Always", "Bon Jovi You Give Love a Bad Name", "Bon Jovi Bed of Roses", "Oasis Wonderwall", "Oasis Dont Look Back in Anger", "Oasis Champagne Supernova", "Oasis Stop Crying Your Heart Out", "Oasis Whatever", "芒果醬 不知不覺", "芒果醬 地下道", "芒果醬 好不好", "芒果醬 夏天的風", "芒果醬 想見你", "美秀集團 捲菸", "美秀集團 米兒", "美秀集團 電火王", "美秀集團 Disco Light", "美秀集團 聖筊", "美秀集團 沒有人在乎你的功勞", "頑童MJ116 辣台妹", "頑童MJ116 幹大事", "頑童MJ116 夜店買醉", "頑童MJ116 兄弟", "頑童MJ116 嗨什麼", "頑童MJ116 Truther", "頑童MJ116 幼稚園", "瘦子E.SO 愛麗絲", "瘦子E.SO Outta Control", "瘦子E.SO 十年磨一劍", "瘦子E.SO 爸爸", "瘦子E.SO Mr Vampire", "瘦子E.SO 雙人舞", "瘦子E.SO 一念之間"];

/* ----------------------------- 共享狀態 ----------------------------- */
const state = { nowPlaying: null, queue: [], history: [], leaderboard: {} };
let seq = 1;
const clients = new Set();

/* ----------------------------- 工具函式 ----------------------------- */
function extractVideoId(input) {
  if (!input) return null;
  const str = String(input).trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/, /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/, /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) { const m = str.match(re); if (m) return m[1]; }
  return null;
}
const YT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
  Cookie: 'CONSENT=YES+1; SOCS=CAI',
};
async function fetchVideoMeta(videoId) {
  const url = 'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + videoId);
  try {
    const res = await fetch(url, { headers: YT_HEADERS });
    if (!res.ok) throw new Error('oembed ' + res.status);
    const j = await res.json();
    return { title: j.title || '未知曲目', thumbnail: j.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, author: j.author_name || '' };
  } catch (e) {
    return { title: 'YouTube 影片', thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, author: '' };
  }
}
async function searchYouTube(query) {
  if (YT_API_KEY) {
    try {
      const url = 'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=12&q=' + encodeURIComponent(query) + '&key=' + YT_API_KEY;
      const res = await fetch(url); const j = await res.json();
      if (j.items) return j.items.map((it) => ({ videoId: it.id.videoId, title: it.snippet.title, thumbnail: it.snippet.thumbnails && it.snippet.thumbnails.medium && it.snippet.thumbnails.medium.url, author: it.snippet.channelTitle, duration: '' }));
    } catch (e) { /* fall through */ }
  }
  return scrapeSearch(query);
}
async function scrapeSearch(query) {
  const url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query) + '&sp=EgIQAQ%253D%253D';
  const res = await fetch(url, { headers: YT_HEADERS });
  const html = await res.text();
  const m = html.match(/var ytInitialData\s*=\s*(\{.+?\});<\/script>/s) || html.match(/ytInitialData"?\]?\s*=\s*(\{.+?\});\s*<\/script>/s) || html.match(/ytInitialData\s*=\s*(\{.+?\});/s);
  if (!m) return [];
  let data; try { data = JSON.parse(m[1]); } catch (e) { return []; }
  const results = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object' || results.length >= 12) return;
    if (node.videoRenderer) {
      const v = node.videoRenderer;
      const title = (v.title && v.title.runs && v.title.runs[0] && v.title.runs[0].text) || (v.title && v.title.simpleText) || '';
      if (v.videoId && title) {
        const thumbs = v.thumbnail && v.thumbnail.thumbnails;
        results.push({
          videoId: v.videoId, title,
          thumbnail: (thumbs && thumbs[thumbs.length - 1] && thumbs[thumbs.length - 1].url) || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
          author: (v.ownerText && v.ownerText.runs && v.ownerText.runs[0] && v.ownerText.runs[0].text) || '',
          duration: (v.lengthText && v.lengthText.simpleText) || '',
        });
      }
      return;
    }
    for (const k in node) walk(node[k]);
  };
  walk(data); return results;
}

/* ----------------------------- 佇列 + 自動點歌 ----------------------------- */
function promoteIfIdle() {
  if (!state.nowPlaying && state.queue.length) {
    state.nowPlaying = { ...state.queue.shift(), position: 0, duration: 0, paused: false };
  }
}
function finishCurrent(toHistory = true) {
  const cur = state.nowPlaying;
  if (cur) {
    if (toHistory && !cur.isDJ) {
      state.history.unshift({ videoId: cur.videoId, title: cur.title, thumbnail: cur.thumbnail, requester: cur.requester, playedAt: Date.now() });
      if (state.history.length > MAX_HISTORY) state.history.length = MAX_HISTORY;
      const name = (cur.requester || '匿名').trim() || '匿名';
      state.leaderboard[name] = (state.leaderboard[name] || 0) + 1;
    }
    state.nowPlaying = null;
  }
  promoteIfIdle();
  maybeAutoDJ();
}

let djPending = false;
const djRecent = [];
function pickSongName() {
  let name = DJ_SONGS[0];
  for (let i = 0; i < 40; i++) {
    name = DJ_SONGS[Math.floor(Math.random() * DJ_SONGS.length)];
    if (!djRecent.includes(name)) break;
  }
  djRecent.push(name);
  if (djRecent.length > Math.min(90, DJ_SONGS.length - 10)) djRecent.shift();
  return name;
}
async function maybeAutoDJ() {
  if (state.nowPlaying || state.queue.length || djPending) return;
  djPending = true;
  try {
    const name = pickSongName();
    let results = [];
    try { results = await searchYouTube(name); } catch (e) {}
    if (state.nowPlaying || state.queue.length) return; // 期間有人點歌了
    const v = results && results[0];
    if (v && v.videoId) {
      state.nowPlaying = {
        id: seq++, videoId: v.videoId, title: v.title || name,
        thumbnail: v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
        requester: '🎲 自動點歌', isDJ: true, position: 0, duration: 0, paused: false,
      };
      broadcastState();
      broadcast({ type: 'command', action: 'load' }, (c) => c.role === 'player');
    } else {
      setTimeout(maybeAutoDJ, 4000); // 搜尋失敗稍後再試
    }
  } finally {
    djPending = false;
  }
}

/* ----------------------------- 廣播 ----------------------------- */
function playerCount() { let n = 0; for (const c of clients) if (c.role === 'player') n++; return n; }
function publicState() {
  return {
    type: 'state', nowPlaying: state.nowPlaying, queue: state.queue,
    history: state.history.slice(0, 60),
    leaderboard: Object.entries(state.leaderboard).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 15),
    online: clients.size,
    players: playerCount(),
  };
}
function broadcast(obj, filter) {
  const msg = JSON.stringify(obj);
  for (const c of clients) { if (filter && !filter(c)) continue; if (c.ws.readyState === 1) c.ws.send(msg); }
}
function broadcastState() { broadcast(publicState()); }

/* ----------------------------- HTTP ----------------------------- */
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.get('/api/search', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!q) return res.json({ results: [] });
  try { res.json({ results: await searchYouTube(q) }); }
  catch (e) { res.status(500).json({ results: [], error: 'search_failed' }); }
});
app.get('/api/meta', async (req, res) => {
  const id = extractVideoId(req.query.url || req.query.id);
  if (!id) return res.status(400).json({ error: 'bad_id' });
  res.json({ videoId: id, ...(await fetchVideoMeta(id)) });
});

/* 清洗 YouTube 標題，盡量留下「歌手 歌名」方便查歌詞 */
function cleanForLyrics(title) {
  let t = String(title || '');
  t = t.replace(/[\(\[（【][^\)\]）】]*[\)\]）】]/g, ' '); // 去掉括號內容
  t = t.replace(/[｜|].*/g, ' ');                          // 去掉直線後面的雜訊
  const noise = /(official|music|video|mv|m\/v|lyrics?|audio|hd|4k|hq|live|performance|visualizer|cover|feat\.?|ft\.?|官方|高清|完整版|歌詞|動態歌詞|純享|現場|版)/gi;
  t = t.replace(noise, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

/* 歌詞查詢：LRCLIB（免費）。回傳 synced（帶時間軸）/ plain（純文字）/ none */
app.get('/api/lyrics', async (req, res) => {
  const raw = (req.query.title || '').toString().trim();
  if (!raw) return res.json({ mode: 'none' });
  const q = cleanForLyrics(raw) || raw;
  try {
    const r = await fetch('https://lrclib.net/api/search?q=' + encodeURIComponent(q), {
      headers: { 'User-Agent': 'DU-Radio (office jukebox)' },
    });
    if (!r.ok) return res.json({ mode: 'none' });
    const arr = await r.json();
    if (Array.isArray(arr) && arr.length) {
      const synced = arr.find((x) => x.syncedLyrics && x.syncedLyrics.length > 5);
      if (synced) return res.json({ mode: 'synced', synced: synced.syncedLyrics, track: synced.trackName, artist: synced.artistName });
      const plain = arr.find((x) => x.plainLyrics && x.plainLyrics.length > 5);
      if (plain) return res.json({ mode: 'plain', plain: plain.plainLyrics, track: plain.trackName, artist: plain.artistName });
    }
    res.json({ mode: 'none' });
  } catch (e) {
    res.json({ mode: 'none' });
  }
});

/* ----------------------------- WebSocket ----------------------------- */
wss.on('connection', (ws) => {
  const client = { ws, role: 'remote' };
  clients.add(client);
  ws.send(JSON.stringify(publicState()));
  broadcast({ type: 'online', online: clients.size });

  ws.on('message', async (raw) => {
    let msg; try { msg = JSON.parse(raw.toString()); } catch { return; }
    switch (msg.type) {
      case 'hello':
        client.role = msg.role === 'player' ? 'player' : 'remote';
        if (client.role === 'player') { maybeAutoDJ(); broadcastState(); }
        break;

      case 'add': {
        const videoId = extractVideoId(msg.videoId || msg.url);
        if (!videoId) { ws.send(JSON.stringify({ type: 'error', message: '無法辨識的 YouTube 網址' })); break; }
        let title = msg.title, thumbnail = msg.thumbnail;
        if (!title) { const meta = await fetchVideoMeta(videoId); title = meta.title; thumbnail = meta.thumbnail; }
        const requester = (msg.requester || '').toString().slice(0, 24).trim() || '匿名';
        state.queue.push({ id: seq++, videoId, title, thumbnail: thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, requester, addedAt: Date.now() });
        if (state.nowPlaying && state.nowPlaying.isDJ) {
          finishCurrent(false);
          broadcast({ type: 'command', action: 'load' }, (c) => c.role === 'player');
        }
        promoteIfIdle();
        broadcastState();
        broadcast({ type: 'toast', message: `🎵 ${requester} 點了《${title}》` });
        break;
      }

      case 'remove':
        state.queue = state.queue.filter((q) => q.id !== msg.id);
        broadcastState(); break;

      case 'jump': {
        const i = state.queue.findIndex((q) => q.id === msg.id);
        if (i > 0) { const [it] = state.queue.splice(i, 1); state.queue.unshift(it); broadcastState(); }
        break;
      }

      case 'move': {
        const i = state.queue.findIndex((q) => q.id === msg.id);
        if (i < 0) break;
        let to = (typeof msg.toIndex === 'number') ? msg.toIndex : i;
        to = Math.max(0, Math.min(state.queue.length - 1, to));
        if (to !== i) { const [it] = state.queue.splice(i, 1); state.queue.splice(to, 0, it); broadcastState(); }
        break;
      }

      case 'skip':
        if (client.role !== 'player') break;
        finishCurrent(true); broadcastState();
        broadcast({ type: 'command', action: 'load' }, (c) => c.role === 'player');
        break;

      case 'control':
        if (client.role !== 'player') break;
        broadcast({ type: 'command', action: msg.action, value: msg.value }, (c) => c.role === 'player');
        break;

      case 'ended':
        if (client.role !== 'player') break;
        if (state.nowPlaying && state.nowPlaying.videoId === msg.videoId) {
          finishCurrent(true); broadcastState();
          broadcast({ type: 'command', action: 'load' }, (c) => c.role === 'player');
        }
        break;

      case 'progress':
        if (client.role !== 'player') break;
        if (state.nowPlaying) {
          state.nowPlaying.position = msg.position || 0;
          state.nowPlaying.duration = msg.duration || 0;
          state.nowPlaying.paused = !!msg.paused;
          broadcast({ type: 'progress', position: state.nowPlaying.position, duration: state.nowPlaying.duration, paused: state.nowPlaying.paused });
        }
        break;

      case 'chat': {
        const name = (msg.name || '匿名').toString().slice(0, 24);
        const text = (msg.text || '').toString().slice(0, 200);
        if (text.trim()) broadcast({ type: 'chat', name, text, at: Date.now() });
        break;
      }
      default: break;
    }
  });

  ws.on('close', () => { clients.delete(client); broadcast({ type: 'online', online: clients.size }); });
});

/* ----------------------------- 啟動 ----------------------------- */
function lanIPs() {
  const out = []; const ifaces = os.networkInterfaces();
  for (const name in ifaces) for (const i of ifaces[name]) if (i.family === 'IPv4' && !i.internal) out.push(i.address);
  return out;
}
server.listen(PORT, '0.0.0.0', () => {
  console.log('\n  📻  DU電台 已開台\n');
  console.log('  網址首頁（用戶打開後選「我要點歌」）：');
  console.log(`    本機： http://localhost:${PORT}`);
  for (const ip of lanIPs()) console.log(`    區域網路： http://${ip}:${PORT}`);
  console.log('\n  放送端（首頁選「我是放送端」，或直接 /player.html）：');
  console.log(`    http://localhost:${PORT}/player.html`);
  console.log('\n  放送端免密碼。沒歌時自動點歌（內建約 982 首中/韓/英）。');
  console.log(YT_API_KEY ? '  搜尋：使用官方 YouTube Data API\n' : '  搜尋：使用網頁解析（免 API key）。\n');
});
