# 日本株代表イレブン

日本株から11銘柄を選び、自分だけの「○○ジャパン」を編成する金融エンタメWebアプリです。

## v0.1 MVP Dashboard

現時点のMVPは、参考画像に寄せた白ベース・青アクセントの金融ダッシュボードUIです。
中央に4-3-3のサッカーピッチを配置し、左右にチームサマリー、勝負状況、参加チームランキングを表示します。

## MVP機能

- チーム名入力と「○○ジャパン」表示
- プライム / スタンダード / グロースの市場区分フィルター
- 銘柄名・証券コード検索
- 11銘柄の選抜
- FW / MF / DF / GK のポジション割り振り
- 複数フォーメーションの切り替え
- ピッチ上の銘柄カード配置とミニフォーメーション図の連動
- ポジション配置に基づくチーム診断
- チームスコア表示
- 勝負状況チャート風UI（あなた / 現在1位 / 参加チーム中央値）
- 参加チームランキング
- 投資助言ではないことを明示する免責文

## ポジション定義

- FW：値上がり期待・成長性を担う攻撃力
- MF：収益力・バランスを担う中盤力
- DF：安定性・下落耐性を担う守備力
- GK：財務健全性・守備力を担う最後の砦

## フォーメーション定義

フォーメーションは、単なる見た目ではなく、チームの投資スタイルを表す要素として扱います。

| フォーメーション | ポジション構成 | 位置づけ |
|---|---|---|
| 4-3-3 | FW 3 / MF 3 / DF 4 / GK 1 | 成長期待を前線に並べる標準型 |
| 4-2-3-1 | FW 1 / MF 5 / DF 4 / GK 1 | 絶対的エースを中盤で支える1トップ型 |
| 4-4-2 | FW 2 / MF 4 / DF 4 / GK 1 | 中盤を厚くするバランス型 |
| 3-5-2 | FW 2 / MF 5 / DF 3 / GK 1 | 収益力と分散を重視する中盤型 |
| 3-4-3 | FW 3 / MF 4 / DF 3 / GK 1 | 攻撃力を残しつつ中盤も厚い型 |
| 5-3-2 | FW 2 / MF 3 / DF 5 / GK 1 | 守備と下落耐性を重視する堅守型 |
| 3-4-2-1 | FW 1 / MF 6 / DF 3 / GK 1 | 中盤の厚みでエースを押し上げる攻撃的1トップ型 |
| 5-4-1 | FW 1 / MF 4 / DF 5 / GK 1 | 守備を固めて一撃を狙う堅守カウンター型 |

## チームリターン計算仕様

チームリターンは、単純な11銘柄の平均リターンではなく、各銘柄の株価リターンをフォーメーションごとのポジション比重で加重平均したゲーム内スコアとして扱います。

```text
チームリターン =
  FW銘柄のリターン × FW比重
+ MF銘柄のリターン × MF比重
+ DF銘柄のリターン × DF比重
+ GK銘柄のリターン × GK比重
```

各ポジション内では、同じポジションに配置された銘柄で比重を等分します。

例：4-2-3-1 の場合

```text
FW比重 25%：FW 1銘柄なので1銘柄あたり25%
MF比重 40%：MF 5銘柄なので1銘柄あたり8%
DF比重 25%：DF 4銘柄なので1銘柄あたり6.25%
GK比重 10%：GK 1銘柄なので1銘柄あたり10%
```

これにより、同じ11銘柄を選んだ場合でも、どの銘柄をFW / MF / DF / GKに置くか、どのフォーメーションを選ぶかによってチームリターンが変わります。

## フォーメーション別ポジション比重案

| フォーメーション | FW | MF | DF | GK | 意味 |
|---|---:|---:|---:|---:|---|
| 4-3-3 | 35% | 30% | 25% | 10% | 標準的な攻撃型 |
| 4-2-3-1 | 25% | 40% | 25% | 10% | 1トップ＋中盤支配 |
| 4-4-2 | 30% | 35% | 25% | 10% | バランス型 |
| 3-5-2 | 25% | 40% | 25% | 10% | 中盤重視型 |
| 3-4-3 | 38% | 32% | 20% | 10% | 超攻撃型 |
| 5-3-2 | 22% | 28% | 40% | 10% | 守備重視型 |
| 3-4-2-1 | 28% | 42% | 20% | 10% | 攻撃的1トップ |
| 5-4-1 | 20% | 30% | 40% | 10% | 堅守カウンター型 |

## 貢献度ランキング仕様

得点ランキングの貢献度は、将来的には以下の計算で表示します。

```text
貢献度 = 個別リターン × その銘柄のポジション内ウェイト
```

これにより、上昇した銘柄を重みの大きいポジションに置いた場合はチームリターンへの貢献が大きくなり、逆に下落した銘柄を重みの大きいポジションに置いた場合はチームリターンを大きく押し下げます。

## 大会ルール上の注意

編成中はフォーメーション、銘柄、ポジションを自由に変更でき、チームリターンの試算も変わってよいものとします。

ただし、大会参加後は後出し変更を防ぐため、以下をロックする必要があります。

- チーム確定時の11銘柄
- チーム確定時の各銘柄のポジション
- チーム確定時のフォーメーション

## 想定アーキテクチャ

本アプリは、以下の3層構成を想定します。

```text
フロントエンド：Vercel
バックエンド：Render
DB / Auth：Supabase
```

### フロントエンド：Vercel

React / Vite による画面表示を担当します。

主な役割：

- チーム編成画面の表示
- チーム名、フォーメーション、銘柄、ポジションの入力
- エントリー操作
- ランキング、勝負状況、ピッチUIの表示

Vercel側の環境変数例：

```text
VITE_API_BASE=https://xxxxx.onrender.com
VITE_SUPABASE_URL=xxxxx
VITE_SUPABASE_PUBLISHABLE_KEY=xxxxx
```

`VITE_SUPABASE_PUBLISHABLE_KEY` は公開前提のキーとして扱います。`service_role key` は絶対にフロントエンドへ置きません。

### バックエンド：Render

Node / Express によるAPIサーバーを想定します。

主な役割：

- 株価取得プロキシ
- エントリー保存API
- エントリー内容の検証
- ランキング計算API
- 勝負状況（あなた / 現在1位 / 中央値）の集計
- 将来的な不正対策、定期集計

Render側の環境変数例：

```text
SUPABASE_URL=xxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxx
```

`SUPABASE_SERVICE_ROLE_KEY` は管理者権限を持つため、Render側だけに置きます。

### DB / Auth：Supabase

Supabase Postgres を、ユーザーエントリー、大会、ランキング集計の保存先として使います。

最初はログイン必須の投資管理アプリではなく、ゲーム参加用のエントリー管理として扱います。

## ユーザーデータ管理方針

本アプリは証券口座連携や実保有株管理ではなく、一回勝負のゲームエントリーを管理します。

そのため、ユーザーデータ管理の中心は「ユーザー」ではなく「エントリー」です。

保存対象：

- 大会ID
- チーム名
- フォーメーション
- 11銘柄
- 各銘柄のポジション
- エントリー状態
- エントリー日時
- 所有ユーザーID

保存しないもの：

- 実際の保有株数
- 証券口座情報
- 購入単価
- 個人の資産情報

## Supabaseテーブル案

MVPでは以下のテーブル構成を想定します。

```text
profiles
contests
entries
entry_members
entry_results
```

### profiles

ユーザー表示名などの最小プロフィールを保存します。

```text
id uuid primary key
display_name text
created_at timestamptz
```

### contests

大会情報を保存します。

```text
id uuid primary key
name text
start_date date
end_date date
entry_deadline timestamptz
status text
judge_rule text
created_at timestamptz
```

### entries

1チーム1エントリーを保存します。

```text
id uuid primary key
contest_id uuid
user_id uuid
team_name text
formation text
status text
locked_at timestamptz
created_at timestamptz
updated_at timestamptz
```

### entry_members

エントリー時点の11銘柄と配置を保存します。

```text
id uuid primary key
entry_id uuid
stock_code text
stock_name text
position text
slot_order int
weight numeric
```

### entry_results

集計結果を保存します。

```text
entry_id uuid primary key
contest_id uuid
team_return numeric
rank int
calculated_at timestamptz
```

## ランキング・勝負状況の算出方針

右カラムの「勝負状況」は、将来的には `entry_results` をもとに表示します。

```text
あなた        = 自分の entry_results.team_return
現在1位      = 同じ contest_id の max(team_return)
中央値       = 同じ contest_id の percentile_cont(0.5)
1位との差    = 自分の team_return - 現在1位の team_return
中央値との差 = 自分の team_return - 中央値
```

TOPIXは勝敗対象ではなく、参考指数として小さく表示する方針です。

## データ保存フロー

### エントリー時

```text
ユーザーが「代表メンバーを確定して試合にエントリー」を押す
↓
Vercelフロント
↓
Render API /api/entries
↓
Supabaseに entries / entry_members を保存
```

## エントリー保存API仕様

エントリー保存は、フロントエンドからSupabaseへ直接書き込むのではなく、Render上のバックエンドAPIを経由して行います。

### API

```text
POST /api/entries
```

### 役割

ユーザーが「エントリーする」ボタンを押したとき、現在のチーム編成を大会エントリーとして保存します。

本アプリは株購入アプリではなくゲームアプリであるため、実際の保有株数、購入単価、証券口座情報、個人資産情報は保存しません。

### リクエスト項目

```text
contestId
teamName
formation
members[]
```

`members[]` には以下を含めます。

```text
stockCode
stockName
market
position
slotOrder
weight
```

### バックエンド側の検証

Render API側で以下を検証してからSupabaseへ保存します。

- 11銘柄ちょうどであること
- 同じ銘柄コードが重複していないこと
- `position` が `FW` / `MF` / `DF` / `GK` のいずれかであること
- `formation` と各ポジション人数が一致していること
- `slotOrder` が 1〜11 の範囲で重複していないこと
- `weight` が 0 より大きいこと
- 対象大会がエントリー受付中であること
- `entry_deadline` を過ぎていないこと
- 同一ユーザーが同一大会へ有効エントリー済みでないこと

### 保存先

エントリー本体は `entries` に保存します。

```text
contest_id
user_id
team_name
formation
status
locked_at
```

11銘柄の明細は `entry_members` に保存します。

```text
entry_id
stock_code
stock_name
market
position
slot_order
weight
```

エントリー完了時は、`entries.status = entered`、`entries.locked_at = now()` として保存します。

### user_id の扱い

最終的には Supabase Auth のログイン情報から `user_id` を確定します。

ただし初期開発段階では、API単体の保存テストを優先し、開発用の仮ユーザーで動作確認します。その後、Auth正式対応に進みます。

### ランキング表示時

```text
Vercelフロント
↓
Render API /api/contest/:id/standings
↓
Supabaseから entry_results / entries を取得・集計
↓
ランキングと勝負状況を表示
```

## 現時点の制約

- 表示データの一部はサンプルです
- Supabase接続の土台は作成済みですが、エントリー保存APIとランキング実データ化は未実装です
- ユーザー登録・ログイン・チーム保存は未実装です
- 投資助言ではなく、仮想ポートフォリオの可視化を目的とした金融エンタメです

## 開発

```bash
npm install
npm run dev
```

## ビルド

```bash
npm run build
```
