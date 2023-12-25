# vue 파일로 storybook 파일을 만드는 패키지

- 한땀 한땀 만들어야 해서 귀찮은 작업을 도와주는 패키지 입니다
- .vue 파일에서 우클릭을 하고 스토리북 생성을 클릭하면 됩니다

# path alias 등록하는 법

- user settings 에 추가해 주면 됩니다.
- settings.json 파일을 열고 아래처럼 추가해 주세요

```json
{
  // 다른 설정값들...

  "storybook-generator-vue.alias": {
    "@": "src",
    "@public": "src/public"
  }
}
```

- 만약 프로젝트 별로 다르게 하고 싶다면, `.vscode/settings.json` 파일을 만들어서 저 내용을 추가해 주시면 됩니다.
