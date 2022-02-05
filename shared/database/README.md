So you may be asking yourself why some column entities number types aren't typed.
please refer to this quote on: https://orkhan.gitbook.io/typeorm/docs/entities
>Note: CockroachDB returns all numeric data types as string. However if you omit column type and define your property as number ORM will parseInt string into number.