# 微信支付特约商户进件说明

本项目现在支持服务商通过微信支付特约商户进件接口提交商户/农机手资料：

`POST /v3/applyment4sub/applyment/`

本地业务接口统一为：

- `GET /api/wechat-applyment/mine`：查看当前商户/农机手进件状态
- `POST /api/wechat-applyment/draft`：保存微信支付进件资料草稿
- `POST /api/wechat-applyment/submit`：提交微信支付审核
- `POST /api/wechat-applyment/sync`：同步微信支付审核状态
- `POST /api/wechat-applyment/sub-mchid`：已在线下完成进件时，手动绑定子商户号

## 推荐流程

1. 商户或农机手先完成 Cotton 平台入驻审核。
2. 登录对应账号后，保存微信支付进件草稿。
3. 后端使用微信支付公钥自动加密敏感字段。
4. 后端调用微信支付特约商户进件接口。
5. 保存微信返回的 `applyment_id`。
6. 使用 `sync` 接口查询审核状态。
7. 审核完成后，微信返回 `sub_mchid`，系统自动保存。
8. 有 `sub_mchid` 后，订单才可以发起真实微信支付。

## 完整资料提交方式

`/api/wechat-applyment/draft` 支持直接保存 `raw_applyment`。该字段结构应与微信支付官方 `applyment4sub` 请求体一致，敏感字段填明文即可，后端提交前会加密。

示例：

```json
{
  "business_code": "COTTON_MERCHANT_1001",
  "raw_applyment": {
    "contact_info": {
      "contact_type": "LEGAL",
      "contact_name": "张三",
      "mobile_phone": "13800138000",
      "contact_email": "merchant@example.com"
    },
    "subject_info": {
      "subject_type": "SUBJECT_TYPE_INDIVIDUAL",
      "business_license_info": {
        "license_copy": "营业执照文件 media_id",
        "license_number": "统一社会信用代码或注册号",
        "merchant_name": "营业执照主体名称",
        "legal_person": "经营者或法人姓名"
      },
      "identity_info": {
        "id_card_info": {
          "id_card_copy": "身份证人像面 media_id",
          "id_card_national": "身份证国徽面 media_id",
          "id_card_name": "张三",
          "id_card_number": "身份证号码",
          "card_period_begin": "2020-01-01",
          "card_period_end": "2030-01-01"
        }
      }
    },
    "business_info": {
      "merchant_shortname": "棉花农资店",
      "service_phone": "13800138000",
      "sales_info": {
        "sales_scenes_type": ["SALES_SCENES_MINI_PROGRAM"],
        "mini_program_info": {
          "mini_program_appid": "小程序 AppID",
          "mini_program_pics": ["小程序经营页面截图 media_id"]
        }
      }
    },
    "settlement_info": {
      "settlement_id": "结算规则 ID",
      "qualification_type": "所属行业名称"
    },
    "bank_account_info": {
      "bank_account_type": "BANK_ACCOUNT_TYPE_PERSONAL",
      "account_bank": "开户银行",
      "account_name": "张三",
      "bank_branch_id": "开户银行联行号",
      "account_number": "银行卡号"
    }
  }
}
```

## 敏感字段

以下字段由后端自动使用微信支付公钥加密：

- `contact_info.contact_name`
- `contact_info.contact_id_number`
- `contact_info.mobile_phone`
- `contact_info.contact_email`
- `subject_info.identity_info.id_card_info.id_card_name`
- `subject_info.identity_info.id_card_info.id_card_number`
- `subject_info.identity_info.id_doc_info.id_doc_name`
- `subject_info.identity_info.id_doc_info.id_doc_number`
- `bank_account_info.account_name`
- `bank_account_info.account_number`

如果你传入的 `raw_applyment` 已经自行加密，可额外传：

```json
{
  "raw_applyment_encrypted": true
}
```

这样后端不会重复加密。

## 文件 media_id

微信进件里的营业执照、身份证、经营截图等图片字段需要填写微信支付文件上传接口返回的 `media_id`。

当前项目先支持直接填写 `media_id`。后续可继续接入微信支付文件上传 API，把“上传图片 -> 获取 media_id -> 填入草稿”做成自动流程。
