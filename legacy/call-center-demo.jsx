import React, { useState, useRef, useEffect } from 'react';
import { Phone, PhoneOff, Mic, MicOff, User, Building2, UtensilsCrossed, Hotel, ChevronLeft, FileText, MessageSquare, Brain, Clock, Users, Calendar, Wrench, CreditCard, MapPin, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

// 預設對話腳本
const scenarios = {
  telecom: {
    name: '中華電信',
    icon: Building2,
    color: 'bg-blue-500',
    accentColor: 'text-blue-500',
    bgLight: 'bg-blue-50',
    companyInfo: {
      name: '中華電信股份有限公司',
      service: '24小時客服專線',
      number: '0800-080-090'
    },
    conversations: [
      {
        speaker: 'customer',
        text: '喂！你們中華電信是怎麼回事啊？我家網路一直斷一直斷，已經好幾天了，我在家上班欸，這樣我怎麼工作！',
        analysis: { 
          intent: '報修申訴（情緒激動）', 
          confidence: 0.91, 
          entities: ['網路問題', '頻繁斷線', '持續數天', '在家工作'],
          flags: ['🔴 客戶情緒激動', '⚡ 可能需優先處理', '💼 影響工作']
        },
        action: { type: 'log', message: '偵測到客戶情緒：負面/激動，啟動安撫流程' }
      },
      {
        speaker: 'ai',
        text: '先生/小姐您好，非常抱歉造成您的困擾，我完全理解網路問題對您工作的影響。我是AI客服小華，請讓我立即為您處理。請問可以提供您的市話或寬頻門號嗎？',
        analysis: null,
        action: { type: 'log', message: '執行安撫話術，優先取得客戶資訊' }
      },
      {
        speaker: 'customer',
        text: '02-2876-XXXX，我太太申請的，戶名是林美玲。',
        analysis: { 
          intent: '提供帳戶資訊（非本人）', 
          confidence: 0.88, 
          entities: ['市話: 02-2876-XXXX', '戶名: 林美玲', '來電者: 配偶'],
          flags: ['⚠️ 非本人來電', '🔐 需驗證關係']
        },
        action: { type: 'verify_account', status: '查詢帳戶資料中...' }
      },
      {
        speaker: 'ai',
        text: '好的，查到門號02-2876-XXXX，戶名林美玲小姐。因為您不是申請人本人，請問您的大名，以及與戶主的關係？這是為了紀錄報修聯絡人。',
        analysis: null,
        action: { type: 'log', message: '帳戶驗證: 需確認來電者身份與關係' }
      },
      {
        speaker: 'customer',
        text: '我叫林志豪，她是我太太啦。網路到底什麼時候會好？',
        analysis: { 
          intent: '確認身份 + 追問進度', 
          confidence: 0.90, 
          entities: ['聯絡人: 林志豪', '關係: 配偶'],
          flags: ['✓ 關係合理']
        },
        action: null
      },
      {
        speaker: 'ai',
        text: '林先生您好，了解了。關於網路斷線，請讓我先做簡單的問題排查。請問是完全連不上，還是連得上但會一直斷？另外，數據機上面的燈號顯示什麼顏色？',
        analysis: null,
        action: { type: 'log', message: '開始遠端問題診斷流程' }
      },
      {
        speaker: 'customer',
        text: '就是會連上但過沒多久就斷掉，然後要等很久才會恢復。燈號喔...我看一下...有一個紅色的燈在閃。',
        analysis: { 
          intent: '描述問題症狀', 
          confidence: 0.93, 
          entities: ['症狀: 間歇性斷線', '恢復時間長', '燈號: 紅燈閃爍'],
          flags: ['🔴 紅燈閃爍 = 線路異常', '📍 可能為外線問題']
        },
        action: { type: 'diagnosis', result: '紅燈閃爍通常表示光纖線路訊號異常，需派員現場檢修' }
      },
      {
        speaker: 'ai',
        text: '紅燈閃爍表示線路訊號有問題，這個情況需要工程師到現場檢查。請問您的地址是？以及這幾天方便的維修時段？',
        analysis: null,
        action: { type: 'form_start', formType: 'repair' }
      },
      {
        speaker: 'customer',
        text: '台北市士林區文林路，就是士林夜市那邊附近。時間的話...我禮拜三下午在家，或是週末都可以。',
        analysis: { 
          intent: '提供地址 + 預約時段', 
          confidence: 0.82, 
          entities: ['地址: 台北市士林區文林路（不完整）', '時段: 週三下午 或 週末'],
          flags: ['⚠️ 地址不完整', '⚠️ 缺少門牌號碼']
        },
        action: null
      },
      {
        speaker: 'ai',
        text: '林先生，文林路那邊我需要完整的門牌號碼才能派工喔。另外，週三下午和週末我幫您查一下工程師的時段...',
        analysis: null,
        action: { type: 'check_schedule', status: '查詢維修時段...' }
      },
      {
        speaker: 'customer',
        text: '喔喔，文林路200號3樓之1。',
        analysis: { 
          intent: '補充完整地址', 
          confidence: 0.97, 
          entities: ['完整地址: 台北市士林區文林路200號3樓之1'],
          flags: ['✓ 地址已完整']
        },
        action: null
      },
      {
        speaker: 'ai',
        text: '好的，台北市士林區文林路200號3樓之1。關於維修時段，週三下午目前已經額滿，最快可以安排週四下午2點到5點，或者週六上午9點到12點，請問哪個比較方便？',
        analysis: null,
        action: { 
          type: 'schedule_result', 
          requested: '週三下午',
          available: false,
          alternatives: [
            { date: '週四 (1/15)', time: '14:00-17:00', status: '可預約' },
            { date: '週六 (1/17)', time: '09:00-12:00', status: '可預約' }
          ]
        }
      },
      {
        speaker: 'customer',
        text: '蛤，週三不行喔...那週四好了。對了，這個要收費嗎？之前換數據機被收了一筆錢。',
        analysis: { 
          intent: '確認時段 + 費用詢問', 
          confidence: 0.89, 
          entities: ['選擇: 週四下午', '費用疑慮', '過去經驗: 曾被收費'],
          flags: ['💰 客戶關心費用']
        },
        action: null
      },
      {
        speaker: 'ai',
        text: '好的，幫您安排週四1月15日下午2點到5點。關於費用，如果是中華電信線路或設備本身的問題，檢修是免費的。但如果是用戶端的設備，例如您自己的路由器或網路線問題，可能會酌收材料費。工程師現場檢查後會先告知再處理，您不用擔心。',
        analysis: null,
        action: { type: 'log', message: '費用說明: 線路問題免費，用戶端設備另計' }
      },
      {
        speaker: 'customer',
        text: '好，那就這樣。你們動作快一點，我真的很急。',
        analysis: { 
          intent: '確認預約 + 催促', 
          confidence: 0.92, 
          entities: ['確認預約', '強調急迫性'],
          flags: ['⏰ 客戶強調急迫']
        },
        action: null
      },
      {
        speaker: 'ai',
        text: '林先生，報修單已經建立，單號 CHT-20260113-0087。我另外幫您備註為優先處理案件，工程師會盡快與您聯繫。維修前一天會發簡訊提醒，届時請保持電話暢通。',
        analysis: null,
        action: { 
          type: 'ticket_created', 
          ticket: {
            type: '網路報修單',
            ticketId: 'CHT-20260113-0087',
            account: '02-2876-XXXX',
            accountHolder: '林美玲',
            contact: '林志豪（配偶）',
            phone: '由帳戶資料帶入',
            address: '台北市士林區文林路200號3樓之1',
            issue: '光纖網路間歇性斷線，數據機紅燈閃爍',
            diagnosis: '疑似外線訊號異常',
            scheduledTime: '2026/01/15 (四) 14:00-17:00',
            priority: '優先處理',
            fee: '線路問題免費，用戶設備另計',
            status: '已派工'
          }
        }
      },
      {
        speaker: 'customer',
        text: '好啦，謝謝。',
        analysis: { 
          intent: '結束通話', 
          confidence: 0.95, 
          entities: [],
          flags: ['😊 情緒已緩和']
        },
        action: null
      },
      {
        speaker: 'ai',
        text: '不客氣，林先生。造成您這幾天的不便真的很抱歉，我們會盡快為您解決問題。如有任何狀況可以隨時撥打客服專線。祝您順心，再見！',
        analysis: null,
        action: { type: 'call_end', summary: '情緒客訴案件 → 安撫成功 → 完成報修派工' }
      }
    ]
  },
  restaurant: {
    name: '雅緻軒餐廳',
    icon: UtensilsCrossed,
    color: 'bg-orange-500',
    accentColor: 'text-orange-500',
    bgLight: 'bg-orange-50',
    companyInfo: {
      name: '雅緻軒精緻料理',
      service: '訂位專線',
      number: '02-2345-6789',
      address: '台北市大安區敦化南路二段88號',
      hours: '11:30-14:30 / 17:30-21:30',
      parking: '特約停車場：敦南停車場（憑消費折抵1小時）'
    },
    conversations: [
      {
        speaker: 'customer',
        text: '喂，我想訂位，大概兩個禮拜後的週末可以嗎？',
        analysis: { 
          intent: '訂位需求', 
          confidence: 0.89, 
          entities: ['訂位', '模糊日期: 兩週後週末'],
          flags: ['⚠️ 模糊日期需解析']
        },
        action: { type: 'date_parsing', input: '兩個禮拜後的週末', result: '2026/01/24 (六) 或 2026/01/25 (日)' }
      },
      {
        speaker: 'ai',
        text: '您好，歡迎來電雅緻軒餐廳。兩週後的週末是1月24日週六或25日週日，請問您要訂哪一天呢？午餐還是晚餐時段？',
        analysis: null,
        action: { type: 'log', message: '日期解析完成: 今日1/12 + 14天 = 1/26，取前一個週末 1/24-25' }
      },
      {
        speaker: 'customer',
        text: '週六晚上吧，6點半左右，我們大概4個人，可能會再多1、2個，還不確定。',
        analysis: { 
          intent: '提供訂位資訊', 
          confidence: 0.85, 
          entities: ['日期: 1/24 週六', '時間: 18:30', '人數: 4-6位（不確定）'],
          flags: ['⚠️ 人數不確定', '⚠️ 需確認最終人數']
        },
        action: { type: 'check_availability', status: '查詢 1/24 18:30 時段...' }
      },
      {
        speaker: 'ai',
        text: '抱歉，1月24日週六晚間6點半的時段目前已經客滿了。我幫您看一下其他時段...同一天5點半或8點還有空位，或者您也可以考慮週日同時段。請問您比較方便哪個選項？',
        analysis: null,
        action: { 
          type: 'availability_result', 
          available: false, 
          alternatives: [
            { date: '1/24 (六)', time: '17:30', status: '可預訂' },
            { date: '1/24 (六)', time: '20:00', status: '可預訂' },
            { date: '1/25 (日)', time: '18:30', status: '可預訂' }
          ]
        }
      },
      {
        speaker: 'customer',
        text: '嗯...8點會不會太晚？我們有帶小朋友。那5點半好了，但是人數我真的不確定欸，可以先訂4位嗎，到時候再加？',
        analysis: { 
          intent: '確認時段 + 人數彈性需求', 
          confidence: 0.88, 
          entities: ['時間: 17:30', '人數: 先訂4位', '有小朋友', '可能加人'],
          flags: ['👶 有兒童同行', '⚠️ 人數可能變動']
        },
        action: null
      },
      {
        speaker: 'ai',
        text: '沒問題！我先幫您預訂4位，如果確定會加人，請最晚在用餐前一天來電告知，我們會盡量幫您安排鄰近座位。另外，因為有小朋友，需要幫您準備兒童座椅嗎？',
        analysis: null,
        action: { type: 'log', message: '備註: 人數可能+1-2，需預留彈性座位' }
      },
      {
        speaker: 'customer',
        text: '好，要一張兒童椅。對了，我們其中一位吃素，你們有素食餐點嗎？',
        analysis: { 
          intent: '特殊需求：兒童椅 + 素食', 
          confidence: 0.94, 
          entities: ['兒童座椅 x1', '素食需求 x1'],
          flags: ['🥬 素食需求', '👶 兒童座椅']
        },
        action: null
      },
      {
        speaker: 'ai',
        text: '有的，我們有提供素食套餐，包含松露野菇燉飯、時蔬沙拉和甜點，一套$680。不過提醒您，我們的松露野菇燉飯使用蛋奶素食材，如果是全素的話要提前說，廚房可以特別準備。',
        analysis: null,
        action: { type: 'info_provided', category: '素食選項' }
      },
      {
        speaker: 'customer',
        text: '蛋奶素可以。那我要訂了，我姓陳，電話0911-222-333。',
        analysis: { 
          intent: '確認訂位 + 提供聯絡資訊', 
          confidence: 0.96, 
          entities: ['姓名: 陳先生/小姐', '電話: 0911-222-333', '蛋奶素確認'],
          flags: []
        },
        action: null
      },
      {
        speaker: 'ai',
        text: '好的，陳先生/小姐，幫您確認一下訂位內容：1月24日週六下午5點30分，4位用餐，需要1張兒童座椅，其中1位素食。訂位代碼是 R-0124-17。請問這樣對嗎？',
        analysis: null,
        action: { 
          type: 'ticket_created', 
          ticket: {
            type: '訂位確認單',
            ticketId: 'R-0124-17',
            name: '陳先生/小姐',
            phone: '0911-222-333',
            date: '2026/01/24 (六)',
            time: '17:30',
            guests: '4位（可能+1-2位）',
            table: 'B區 圓桌',
            specialNeeds: '兒童座椅x1、素食x1（蛋奶素）',
            notes: '人數若增加請前一天來電確認',
            status: '已確認'
          }
        }
      },
      {
        speaker: 'customer',
        text: '對對對。啊，我想問一下，你們的白松露套餐還有嗎？上次想吃結果賣完了。',
        analysis: { 
          intent: '菜色詢問 - 限量品項', 
          confidence: 0.93, 
          entities: ['白松露套餐', '供應狀態查詢'],
          flags: ['🔍 查詢限量品項']
        },
        action: { type: 'check_inventory', item: '冬季白松露套餐' }
      },
      {
        speaker: 'ai',
        text: '讓我查一下...「冬季白松露套餐」目前平日還有供應，但週末的配額已經預訂完了。如果您當天想吃的話，建議可以現在先預訂餐點，我們會幫您保留食材。',
        analysis: null,
        action: { 
          type: 'inventory_result', 
          item: '冬季白松露套餐',
          weekday: '可供應',
          weekend: '已售完',
          suggestion: '可預訂保留'
        }
      },
      {
        speaker: 'customer',
        text: '蛤，週末沒有喔...那算了好了，我們吃別的。謝謝你喔！',
        analysis: { 
          intent: '放棄預訂餐點 + 結束通話', 
          confidence: 0.91, 
          entities: ['取消餐點預訂意向', '結束對話'],
          flags: []
        },
        action: null
      },
      {
        speaker: 'ai',
        text: '好的沒問題！那就維持原本的訂位。提醒您當天請準時入座，逾時15分鐘會自動取消訂位喔。如有任何變動請提前來電，期待為您服務，陳先生/小姐再見！',
        analysis: null,
        action: { type: 'call_end', summary: '完成訂位，未加訂餐點' }
      }
    ]
  },
  hotel: {
    name: '晶華渡假酒店',
    icon: Hotel,
    color: 'bg-purple-500',
    accentColor: 'text-purple-500',
    bgLight: 'bg-purple-50',
    companyInfo: {
      name: '晶華渡假酒店',
      service: '訂房專線',
      number: '03-987-6543',
      address: '宜蘭縣礁溪鄉溫泉路168號',
      rating: '★★★★★'
    },
    conversations: [
      {
        speaker: 'customer',
        text: '你好，我想訂房，大概是中秋節連假那幾天。',
        analysis: { 
          intent: '訂房需求', 
          confidence: 0.87, 
          entities: ['訂房', '模糊日期: 中秋節連假'],
          flags: ['⚠️ 模糊日期需解析', '🔥 熱門時段']
        },
        action: { type: 'date_parsing', input: '中秋節連假', result: '2026年中秋節為10/3 (六)，連假期間 10/1-10/4' }
      },
      {
        speaker: 'ai',
        text: '您好，歡迎來電晶華渡假酒店，我是AI訂房助理。今年中秋節是10月3日週六，連假期間是10月1日到4日。請問您要訂哪幾天呢？需要幾間房？',
        analysis: null,
        action: { type: 'log', message: '節日日期解析: 2026中秋節 = 農曆8/15 = 國曆10/3' }
      },
      {
        speaker: 'customer',
        text: '我想訂10/2到10/4，兩個晚上，需要兩間房。一間要雙人房，另一間要能睡四個人，有小孩。',
        analysis: { 
          intent: '提供訂房資訊', 
          confidence: 0.91, 
          entities: ['入住: 10/2', '退房: 10/4', '2晚', '房間1: 雙人房', '房間2: 四人房（有兒童）'],
          flags: ['🔥 連假旺季', '👶 有兒童同行', '🛏️ 多房型需求']
        },
        action: { type: 'check_availability', status: '查詢 10/2-10/4 房況...' }
      },
      {
        speaker: 'ai',
        text: '讓我查一下中秋連假的房況...10月2日到4日，目前雙人房還有豪華溫泉雙人房可訂，每晚$6,800。但四人房型已經全部訂滿了。不過我可以提供幾個替代方案：兩間相鄰的雙人房，或是一間豪華雙人房加床。請問小朋友幾歲呢？',
        analysis: null,
        action: { 
          type: 'availability_result', 
          available: 'partial',
          details: {
            '豪華溫泉雙人房': '可訂',
            '標準四人房': '已滿',
            '家庭套房': '已滿'
          },
          alternatives: [
            { option: '兩間相鄰雙人房', price: '$6,800 x 2 = $13,600/晚', note: '可安排同樓層' },
            { option: '豪華雙人房+加床', price: '$6,800 + $800 = $7,600/晚', note: '限12歲以下兒童' }
          ]
        }
      },
      {
        speaker: 'customer',
        text: '小朋友一個8歲一個5歲。加床的話兩個小孩睡得下嗎？還是說...你們有沒有什麼優惠啊，連假價格也太貴了吧！',
        analysis: { 
          intent: '確認兒童年齡 + 詢問優惠', 
          confidence: 0.88, 
          entities: ['兒童年齡: 8歲、5歲', '價格異議', '優惠詢問'],
          flags: ['💰 價格敏感', '👶 兒童: 8歲+5歲']
        },
        action: null
      },
      {
        speaker: 'ai',
        text: '8歲和5歲的話，加一張床兩位小朋友一起睡是沒問題的。關於優惠，連假期間房價確實比較高，但我幫您看一下...如果您現在預訂並選擇官網專案，可以享有早餐買一送一，還有免費升等使用行政酒廊。另外，12歲以下兒童早餐免費喔！這樣算下來兩晚大約可以省$1,200。',
        analysis: null,
        action: { 
          type: 'promotion_check', 
          available: [
            { name: '官網專案', benefit: '早餐買一送一', value: '$600/天' },
            { name: '官網專案', benefit: '免費行政酒廊', value: '價值$800' },
            { name: '兒童優惠', benefit: '12歲以下早餐免費', value: '適用2位' }
          ]
        }
      },
      {
        speaker: 'customer',
        text: '好吧...那就訂一間雙人房、一間雙人房加床好了。啊對了，我們有一隻小狗，可以帶去嗎？',
        analysis: { 
          intent: '確認訂房 + 寵物詢問', 
          confidence: 0.90, 
          entities: ['確認: 雙人房x1', '確認: 雙人房+加床x1', '寵物: 狗'],
          flags: ['🐕 寵物需求', '⚠️ 需確認寵物政策']
        },
        action: null
      },
      {
        speaker: 'ai',
        text: '抱歉，我們飯店目前不開放寵物入住，因為溫泉區和餐廳都不方便帶寵物。不過礁溪附近有配合的寵物旅館，我可以提供聯絡資訊給您，很多房客都是把毛小孩寄放在那邊。請問這樣可以嗎？',
        analysis: null,
        action: { 
          type: 'policy_check', 
          policy: '寵物政策',
          result: '不可攜帶寵物',
          alternative: '配合寵物旅館: 礁溪毛寶貝之家 03-988-XXXX'
        }
      },
      {
        speaker: 'customer',
        text: '喔這樣喔...好吧，那我先問問家人，狗的部分再想辦法。可以先幫我保留嗎？不要讓別人訂走。',
        analysis: { 
          intent: '保留訂房（未確認）', 
          confidence: 0.86, 
          entities: ['保留需求', '尚未最終確認'],
          flags: ['⚠️ 訂房未確認', '⏳ 需設定保留期限']
        },
        action: null
      },
      {
        speaker: 'ai',
        text: '好的，我可以幫您先保留，但因為是連假熱門時段，最多只能保留到明天晚上6點喔，超過時間沒有確認的話房間會自動釋出。確認後需要預付50%訂金才算完成訂房。請問您的大名和聯絡電話？',
        analysis: null,
        action: { type: 'log', message: '保留規則: 連假期間最長保留24小時' }
      },
      {
        speaker: 'customer',
        text: '我叫張雅婷，0955-666-777。那取消的話會怎樣？',
        analysis: { 
          intent: '提供聯絡資訊 + 取消政策詢問', 
          confidence: 0.93, 
          entities: ['姓名: 張雅婷', '電話: 0955-666-777', '取消政策詢問'],
          flags: ['📋 需說明取消政策']
        },
        action: null
      },
      {
        speaker: 'ai',
        text: '張小姐您好。關於取消政策：入住日14天前取消可全額退款，7到13天前取消收取30%手續費，7天內取消或未入住則不予退費。連假期間的訂房都適用此規定喔。',
        analysis: null,
        action: { 
          type: 'policy_info', 
          category: '取消政策',
          rules: [
            { period: '14天前', fee: '全額退款' },
            { period: '7-13天前', fee: '收取30%' },
            { period: '7天內/No Show', fee: '不退費' }
          ]
        }
      },
      {
        speaker: 'customer',
        text: '了解，那先這樣保留，我跟家人討論一下晚點回電。',
        analysis: { 
          intent: '確認保留', 
          confidence: 0.94, 
          entities: ['確認保留', '稍後回電'],
          flags: []
        },
        action: null
      },
      {
        speaker: 'ai',
        text: '好的，張小姐。已為您建立保留單，保留單號 H-HOLD-1002-01。房間保留至明天1月13日晚上6點。屆時請來電或透過官網完成付款確認。保留內容：10月2日至4日，豪華溫泉雙人房兩間（其中一間加床），兩晚共$28,800，含早餐、行政酒廊使用。有任何問題隨時來電！',
        analysis: null,
        action: { 
          type: 'ticket_created', 
          ticket: {
            type: '訂房保留單',
            ticketId: 'H-HOLD-1002-01',
            name: '張雅婷',
            phone: '0955-666-777',
            checkIn: '2026/10/02 (五) 15:00',
            checkOut: '2026/10/04 (日) 11:00',
            nights: 2,
            rooms: '豪華溫泉雙人房 x2（1間加床）',
            guests: '大人2位 + 兒童2位(8歲、5歲)',
            price: '$6,800/晚 + $7,600/晚',
            total: '$28,800 (2晚)',
            deposit: '需付$14,400 (50%)',
            includes: '早餐買一送一、行政酒廊、兒童早餐免費',
            holdUntil: '2026/01/13 18:00',
            petNote: '不可攜帶寵物，已提供寵物旅館資訊',
            cancelPolicy: '14天前全退/7-13天扣30%/7天內不退',
            status: '保留中（待確認）'
          }
        }
      },
      {
        speaker: 'customer',
        text: '好，謝謝你說明得很清楚！',
        analysis: { 
          intent: '結束通話', 
          confidence: 0.96, 
          entities: ['正面回饋'],
          flags: ['😊 客戶滿意']
        },
        action: null
      },
      {
        speaker: 'ai',
        text: '不客氣！張小姐，期待您的好消息。中秋連假如果確定入住，記得帶件薄外套，礁溪那時候早晚會比較涼爽，泡湯特別舒服喔。祝您有美好的一天，再見！',
        analysis: null,
        action: { type: 'call_end', summary: '連假訂房 → 四人房滿 → 改雙人房+加床 → 保留待確認' }
      }
    ]
  }
};

export default function CallCenterDemo() {
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [callState, setCallState] = useState('idle'); // idle, dialing, connected, ended
  const [conversationIndex, setConversationIndex] = useState(-1);
  const [displayedConversations, setDisplayedConversations] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [currentAnalysis, setCurrentAnalysis] = useState(null);
  const [systemLogs, setSystemLogs] = useState([]);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  
  const logContainerRef = useRef(null);
  const chatContainerRef = useRef(null);

  // 自動滾動 Log 到底部
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [systemLogs]);

  // 自動滾動對話到底部
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [displayedConversations]);

  // 計時器
  React.useEffect(() => {
    let timer;
    if (callState === 'connected') {
      timer = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [callState]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString('zh-TW');
    setSystemLogs(prev => [...prev, { timestamp, message, type }]);
  };

  const handleSelectScenario = (key) => {
    setSelectedScenario(key);
    setCallState('idle');
    setConversationIndex(-1);
    setDisplayedConversations([]);
    setTickets([]);
    setCurrentAnalysis(null);
    setSystemLogs([]);
    setCallDuration(0);
  };

  const handleDial = () => {
    setCallState('dialing');
    addLog('撥出通話中...', 'system');
    setTimeout(() => {
      setCallState('connected');
      addLog('通話已接通', 'success');
      addLog(`來電類型: ${scenarios[selectedScenario].name}`, 'info');
    }, 2000);
  };

  const handleHangUp = () => {
    setCallState('ended');
    addLog('通話已結束', 'system');
    addLog(`通話時長: ${formatDuration(callDuration)}`, 'info');
  };

  const handleNextStep = () => {
    if (!selectedScenario) return;
    
    const scenario = scenarios[selectedScenario];
    const nextIndex = conversationIndex + 1;
    
    if (nextIndex >= scenario.conversations.length) {
      handleHangUp();
      return;
    }

    const conv = scenario.conversations[nextIndex];
    setConversationIndex(nextIndex);
    setDisplayedConversations(prev => [...prev, conv]);

    // 處理分析
    if (conv.analysis) {
      setCurrentAnalysis(conv.analysis);
      addLog(`意圖識別: ${conv.analysis.intent} (${(conv.analysis.confidence * 100).toFixed(0)}%)`, 'ai');
      conv.analysis.entities.forEach(entity => {
        addLog(`實體擷取: ${entity}`, 'info');
      });
      if (conv.analysis.flags && conv.analysis.flags.length > 0) {
        conv.analysis.flags.forEach(flag => {
          addLog(`標記: ${flag}`, 'warning');
        });
      }
    }

    // 處理動作
    if (conv.action) {
      switch (conv.action.type) {
        case 'query':
        case 'check_availability':
        case 'check_inventory':
        case 'verify_account':
        case 'check_schedule':
          addLog(conv.action.status || `執行: ${conv.action.type}...`, 'system');
          break;
        case 'date_parsing':
          addLog(`日期解析: "${conv.action.input}" → ${conv.action.result}`, 'ai');
          break;
        case 'log':
          addLog(conv.action.message, 'info');
          break;
        case 'diagnosis':
          addLog(`問題診斷: ${conv.action.result}`, 'ai');
          break;
        case 'schedule_result':
          if (conv.action.available === false) {
            addLog(`✗ 時段 "${conv.action.requested}" 已額滿`, 'warning');
          }
          if (conv.action.alternatives) {
            addLog('可用替代時段:', 'info');
            conv.action.alternatives.forEach(alt => {
              addLog(`  → ${alt.date} ${alt.time}: ${alt.status}`, 'success');
            });
          }
          break;
        case 'availability_result':
          if (conv.action.available === true) {
            addLog('✓ 該時段有空位', 'success');
          } else if (conv.action.available === false) {
            addLog('✗ 該時段已客滿', 'warning');
          } else if (conv.action.available === 'partial') {
            addLog('⚠ 部分房型可訂', 'warning');
            if (conv.action.details) {
              Object.entries(conv.action.details).forEach(([room, status]) => {
                addLog(`  ${room}: ${status}`, status === '可訂' ? 'success' : 'warning');
              });
            }
          }
          if (conv.action.alternatives) {
            addLog('替代方案:', 'info');
            conv.action.alternatives.forEach(alt => {
              if (alt.date) {
                addLog(`  → ${alt.date} ${alt.time}: ${alt.status}`, 'info');
              } else if (alt.option) {
                addLog(`  → ${alt.option}: ${alt.price}`, 'info');
              }
            });
          }
          if (conv.action.note) {
            addLog(`備註: ${conv.action.note}`, 'info');
          }
          break;
        case 'promotion_check':
          addLog('可用優惠方案:', 'success');
          conv.action.available.forEach(promo => {
            addLog(`  ✓ ${promo.name}: ${promo.benefit}`, 'success');
          });
          break;
        case 'policy_check':
          addLog(`政策查詢: ${conv.action.policy}`, 'system');
          addLog(`  結果: ${conv.action.result}`, conv.action.result.includes('不') ? 'warning' : 'info');
          if (conv.action.alternative) {
            addLog(`  替代方案: ${conv.action.alternative}`, 'info');
          }
          break;
        case 'policy_info':
          addLog(`${conv.action.category}說明:`, 'info');
          conv.action.rules.forEach(rule => {
            addLog(`  ${rule.period}: ${rule.fee}`, 'info');
          });
          break;
        case 'inventory_result':
          addLog(`庫存查詢: ${conv.action.item}`, 'system');
          addLog(`  平日: ${conv.action.weekday}`, conv.action.weekday === '可供應' ? 'success' : 'warning');
          addLog(`  週末: ${conv.action.weekend}`, conv.action.weekend === '可供應' ? 'success' : 'warning');
          break;
        case 'form_start':
          addLog(`開始建立${conv.action.formType === 'repair' ? '報修單' : conv.action.formType === 'reservation' ? '訂位單' : '訂房單'}`, 'system');
          break;
        case 'info_provided':
          addLog(`提供資訊: ${conv.action.category}`, 'info');
          break;
        case 'ticket_created':
          setTickets(prev => [...prev, conv.action.ticket]);
          addLog(`✓ ${conv.action.ticket.type}已建立: ${conv.action.ticket.ticketId}`, 'success');
          break;
        case 'call_end':
          if (conv.action.summary) {
            addLog(`通話摘要: ${conv.action.summary}`, 'info');
          }
          setTimeout(() => handleHangUp(), 500);
          break;
        default:
          break;
      }
    }
  };

  const handleBack = () => {
    setSelectedScenario(null);
    setCallState('idle');
    setConversationIndex(-1);
    setDisplayedConversations([]);
    setTickets([]);
    setCurrentAnalysis(null);
    setSystemLogs([]);
    setCallDuration(0);
  };

  const scenario = selectedScenario ? scenarios[selectedScenario] : null;
  const IconComponent = scenario?.icon;

  return (
    <div className="flex h-screen bg-gray-100">
      {/* 左側 - 手機模擬器 (1/3) */}
      <div className="w-1/3 p-4 flex items-center justify-center bg-gray-200">
        <div className="w-72 h-[580px] bg-black rounded-[3rem] p-3 shadow-2xl">
          <div className="w-full h-full bg-white rounded-[2.5rem] overflow-hidden flex flex-col">
            {/* 手機頂部 */}
            <div className="h-8 bg-gray-900 flex items-center justify-center">
              <div className="w-20 h-5 bg-black rounded-full"></div>
            </div>

            {/* 手機內容 */}
            <div className="flex-1 bg-gradient-to-b from-gray-50 to-gray-100">
              {!selectedScenario ? (
                // 聯絡人選擇畫面
                <div className="h-full flex flex-col">
                  <div className="p-4 text-center border-b">
                    <h2 className="text-lg font-semibold text-gray-800">選擇撥打對象</h2>
                    <p className="text-xs text-gray-500 mt-1">點擊開始模擬通話</p>
                  </div>
                  <div className="flex-1 p-4 space-y-3">
                    {Object.entries(scenarios).map(([key, s]) => {
                      const Icon = s.icon;
                      return (
                        <button
                          key={key}
                          onClick={() => handleSelectScenario(key)}
                          className={`w-full p-4 rounded-2xl ${s.bgLight} hover:shadow-md transition-all flex items-center gap-4`}
                        >
                          <div className={`w-14 h-14 ${s.color} rounded-full flex items-center justify-center`}>
                            <Icon className="w-7 h-7 text-white" />
                          </div>
                          <div className="text-left">
                            <div className="font-semibold text-gray-800">{s.name}</div>
                            <div className="text-xs text-gray-500">{s.companyInfo.number}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                // 通話畫面
                <div className="h-full flex flex-col">
                  {/* 返回按鈕 */}
                  {callState === 'idle' && (
                    <button
                      onClick={handleBack}
                      className="absolute top-12 left-6 text-gray-600 hover:text-gray-800 flex items-center gap-1 text-sm"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      返回
                    </button>
                  )}

                  {/* 通話資訊 */}
                  <div className="flex-1 flex flex-col items-center justify-center p-6">
                    <div className={`w-24 h-24 ${scenario.color} rounded-full flex items-center justify-center mb-4 ${callState === 'dialing' ? 'animate-pulse' : ''}`}>
                      <IconComponent className="w-12 h-12 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-800">{scenario.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{scenario.companyInfo.number}</p>
                    
                    {callState === 'idle' && (
                      <p className="text-sm text-gray-400 mt-4">點擊撥打開始通話</p>
                    )}
                    {callState === 'dialing' && (
                      <p className="text-sm text-gray-500 mt-4 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        撥號中...
                      </p>
                    )}
                    {callState === 'connected' && (
                      <p className="text-sm text-green-600 mt-4 font-medium">
                        通話中 {formatDuration(callDuration)}
                      </p>
                    )}
                    {callState === 'ended' && (
                      <p className="text-sm text-gray-500 mt-4">
                        通話結束 · {formatDuration(callDuration)}
                      </p>
                    )}
                  </div>

                  {/* 通話控制按鈕 */}
                  <div className="p-6 pb-8">
                    {callState === 'idle' && (
                      <button
                        onClick={handleDial}
                        className="w-full py-4 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center gap-2 transition-colors"
                      >
                        <Phone className="w-5 h-5" />
                        撥打
                      </button>
                    )}
                    {callState === 'dialing' && (
                      <button
                        onClick={handleHangUp}
                        className="w-full py-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center gap-2 transition-colors"
                      >
                        <PhoneOff className="w-5 h-5" />
                        取消
                      </button>
                    )}
                    {callState === 'connected' && (
                      <div className="flex gap-3">
                        <button
                          onClick={() => setIsMuted(!isMuted)}
                          className={`flex-1 py-4 ${isMuted ? 'bg-gray-300' : 'bg-gray-200'} hover:bg-gray-300 rounded-full flex items-center justify-center transition-colors`}
                        >
                          {isMuted ? <MicOff className="w-5 h-5 text-gray-600" /> : <Mic className="w-5 h-5 text-gray-600" />}
                        </button>
                        <button
                          onClick={handleHangUp}
                          className="flex-1 py-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors"
                        >
                          <PhoneOff className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                    {callState === 'ended' && (
                      <button
                        onClick={handleBack}
                        className="w-full py-4 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full flex items-center justify-center gap-2 transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5" />
                        返回選單
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 右側 - 儀錶板 (2/3) */}
      <div className="w-2/3 flex flex-col bg-gray-50">
        {/* 頂部標題列 */}
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-800">AI 客服值機儀錶板</h1>
              <p className="text-xs text-gray-500">智能語音助理輔助系統</p>
            </div>
          </div>
          
          {/* 狀態指示 */}
          <div className="flex items-center gap-4">
            {callState === 'connected' && scenario && (
              <>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  通話中
                </div>
                <div className={`px-3 py-1.5 ${scenario.bgLight} ${scenario.accentColor} rounded-full text-sm font-medium`}>
                  {scenario.name}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 主要內容區 */}
        <div className="flex-1 p-4 overflow-hidden flex gap-4">
          {/* 左欄 - 對話逐字稿 + 下一步按鈕 */}
          <div className="w-1/2 flex flex-col gap-4">
            {/* 對話逐字稿 */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-gray-500" />
                <h2 className="font-semibold text-gray-700">即時對話逐字稿</h2>
              </div>
              <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {displayedConversations.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                    {callState === 'connected' ? '點擊「下一步」開始對話模擬' : '等待通話接通...'}
                  </div>
                ) : (
                  displayedConversations.map((conv, idx) => (
                    <div
                      key={idx}
                      className={`flex ${conv.speaker === 'customer' ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm ${
                          conv.speaker === 'customer'
                            ? 'bg-gray-100 text-gray-800 rounded-bl-md'
                            : 'bg-indigo-500 text-white rounded-br-md'
                        }`}
                      >
                        <div className="text-xs opacity-70 mb-1">
                          {conv.speaker === 'customer' ? '👤 客戶' : '🤖 AI助理'}
                        </div>
                        {conv.text}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 下一步按鈕 */}
            {callState === 'connected' && (
              <button
                onClick={handleNextStep}
                className="py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                {conversationIndex < (scenario?.conversations.length || 0) - 1 ? (
                  <>
                    <span>下一步對話</span>
                    <span className="text-indigo-200 text-sm">
                      ({conversationIndex + 2}/{scenario?.conversations.length})
                    </span>
                  </>
                ) : (
                  '結束通話'
                )}
              </button>
            )}
          </div>

          {/* 右欄 - AI分析 + 產生單據 + 系統Log */}
          <div className="w-1/2 flex flex-col gap-4">
            {/* AI 意圖分析 */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-500" />
                <h2 className="font-semibold text-gray-700">AI 意圖分析</h2>
              </div>
              <div className="p-4">
                {currentAnalysis ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">識別意圖</span>
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                        {currentAnalysis.intent}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">信心度</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-purple-500 rounded-full"
                            style={{ width: `${currentAnalysis.confidence * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium">{(currentAnalysis.confidence * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                    {currentAnalysis.entities.length > 0 && (
                      <div>
                        <span className="text-sm text-gray-500">擷取實體</span>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {currentAnalysis.entities.map((entity, idx) => (
                            <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                              {entity}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {currentAnalysis.flags && currentAnalysis.flags.length > 0 && (
                      <div>
                        <span className="text-sm text-gray-500">注意標記</span>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {currentAnalysis.flags.map((flag, idx) => (
                            <span key={idx} className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">
                              {flag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-gray-400 text-sm py-4">
                    等待客戶發話...
                  </div>
                )}
              </div>
            </div>

            {/* 產生的單據 */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden flex-1">
              <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
                <FileText className="w-4 h-4 text-green-500" />
                <h2 className="font-semibold text-gray-700">產生單據</h2>
                {tickets.length > 0 && (
                  <span className="ml-auto px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">
                    {tickets.length}
                  </span>
                )}
              </div>
              <div className="p-4 overflow-y-auto max-h-64">
                {tickets.length === 0 ? (
                  <div className="text-center text-gray-400 text-sm py-4">
                    尚無單據產生
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tickets.map((ticket, idx) => (
                      <div key={idx} className="p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-green-800 text-sm">{ticket.type}</span>
                          <span className="text-xs text-green-600">{ticket.ticketId}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          {Object.entries(ticket).map(([key, value]) => {
                            if (key === 'type' || key === 'ticketId') return null;
                            const labels = {
                              name: '姓名', phone: '電話', address: '地址', issue: '問題',
                              scheduledTime: '預約時間', status: '狀態', date: '日期',
                              time: '時間', guests: '人數', table: '座位', notes: '備註',
                              checkIn: '入住', checkOut: '退房', nights: '晚數',
                              roomType: '房型', rooms: '房間', price: '房價', total: '總額',
                              deposit: '訂金', includes: '含', specialNeeds: '特殊需求',
                              account: '帳號', accountHolder: '戶名', contact: '聯絡人',
                              diagnosis: '初步診斷', priority: '優先序', fee: '費用說明',
                              holdUntil: '保留至', petNote: '寵物備註', cancelPolicy: '取消政策'
                            };
                            return (
                              <div key={key} className="flex">
                                <span className="text-gray-500 w-16">{labels[key] || key}:</span>
                                <span className="text-gray-800 flex-1">{value}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 系統 Log */}
            <div className="bg-gray-900 rounded-xl shadow-sm overflow-hidden h-44">
              <div className="px-4 py-2 border-b border-gray-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-gray-400" />
                <h2 className="font-medium text-gray-300 text-sm">系統 Log</h2>
              </div>
              <div ref={logContainerRef} className="p-3 overflow-y-auto h-32 font-mono text-xs">
                {systemLogs.length === 0 ? (
                  <div className="text-gray-500">等待系統事件...</div>
                ) : (
                  systemLogs.map((log, idx) => (
                    <div key={idx} className={`${
                      log.type === 'success' ? 'text-green-400' :
                      log.type === 'ai' ? 'text-purple-400' :
                      log.type === 'system' ? 'text-yellow-400' :
                      log.type === 'warning' ? 'text-orange-400' :
                      'text-gray-400'
                    }`}>
                      <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
