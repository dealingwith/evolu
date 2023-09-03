import * as Schema from "@effect/schema/Schema";
import { Either } from "effect";
import { constVoid } from "effect/Function";
import * as Evolu from "evolu";
import {
  FC,
  Suspense,
  memo,
  startTransition,
  useEffect,
  useState,
} from "react";
import {
  Button,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import RNPickerSelect from "react-native-picker-select";

const TodoId = Evolu.id("Todo");
type TodoId = Schema.To<typeof TodoId>;

const TodoCategoryId = Evolu.id("TodoCategory");
type TodoCategoryId = Schema.To<typeof TodoCategoryId>;

const NonEmptyString50 = Schema.string.pipe(
  Schema.minLength(1),
  Schema.maxLength(50),
  Schema.brand("NonEmptyString50"),
);
type NonEmptyString50 = Schema.To<typeof NonEmptyString50>;

const TodoTable = Schema.struct({
  id: TodoId,
  title: Evolu.NonEmptyString1000,
  isCompleted: Evolu.SqliteBoolean,
  categoryId: Schema.nullable(TodoCategoryId),
});
type TodoTable = Schema.To<typeof TodoTable>;

const TodoCategoryTable = Schema.struct({
  id: TodoCategoryId,
  name: NonEmptyString50,
});
type TodoCategoryTable = Schema.To<typeof TodoCategoryTable>;

const Database = Schema.struct({
  todo: TodoTable,
  todoCategory: TodoCategoryTable,
});

const { useQuery, useMutation, useEvoluError, useOwner, useOwnerActions } =
  Evolu.create(Database, {
    ...(process.env.NODE_ENV === "development" && {
      syncUrl: "http://localhost:4000",
    }),
  });

const TodoCategorySelect: FC<{
  selected: TodoCategoryId | null;
  onSelect: (_value: TodoCategoryId | null) => void;
}> = ({ selected, onSelect }) => {
  const nothingSelected = "";
  const { rows } = useQuery(
    (db) =>
      db
        .selectFrom("todoCategory")
        .select(["id", "name"])
        .where("isDeleted", "is not", Evolu.cast(true))
        .orderBy("createdAt"),
    // Filter out rows with nullable names.
    ({ name, ...rest }) => name && { name, ...rest },
  );

  const value =
    selected && rows.find((row) => row.id === selected)
      ? selected
      : nothingSelected;

  return (
    <RNPickerSelect
      value={value}
      onValueChange={(value: TodoCategoryId | null): void => {
        onSelect(value);
      }}
      items={rows.map((row) => ({ label: row.name, value: row.id }))}
    />
  );
};

const TodoItem = memo<{
  row: Pick<TodoTable, "id" | "title" | "isCompleted" | "categoryId">;
}>(function TodoItem({ row: { id, title, isCompleted, categoryId } }) {
  const { update } = useMutation();

  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: "row" }}>
        <Text
          style={[
            appStyles.item,
            { textDecorationLine: isCompleted ? "line-through" : "none" },
          ]}
        >
          {title}
        </Text>
        <TodoCategorySelect
          selected={categoryId}
          onSelect={(categoryId): void => {
            update("todo", { id, categoryId });
          }}
        />
      </View>
      <View style={{ flexDirection: "row" }}>
        <Button
          title={isCompleted ? "Completed" : "Complete"}
          onPress={(): void => {
            update("todo", { id, isCompleted: !isCompleted });
          }}
        />
        <Button
          title="Delete"
          onPress={(): void => {
            update("todo", { id, isDeleted: true });
          }}
        />
      </View>
    </View>
  );
});

const Todos: FC = () => {
  const { create } = useMutation();
  const { rows } = useQuery(
    (db) =>
      db
        .selectFrom("todo")
        .select(["id", "title", "isCompleted", "categoryId"])
        .where("isDeleted", "is not", Evolu.cast(true))
        .orderBy("createdAt"),
    // (row) => row
    ({ title, isCompleted, ...rest }) =>
      title && isCompleted != null && { title, isCompleted, ...rest },
  );

  const [text, setText] = useState("");
  const newTodoTitle = Schema.parseEither(Evolu.NonEmptyString1000)(text);
  const handleTextInputEndEditing = (): void => {
    newTodoTitle.pipe(
      Either.match({
        onLeft: constVoid,
        onRight: (title) => {
          create("todo", { title, isCompleted: false });
          setText("");
        },
      }),
    );
  };

  return (
    <>
      <Text style={appStyles.h2}>Todos</Text>
      <View>
        {rows.map((row) => (
          <TodoItem key={row.id} row={row} />
        ))}
      </View>
      <TextInput
        autoComplete="off"
        autoCorrect={false}
        style={appStyles.textInput}
        value={text}
        onChangeText={setText}
        placeholder="What needs to be done?"
        onEndEditing={handleTextInputEndEditing}
      />
    </>
  );
};

const TodoCategories: FC = () => {
  const { create, update } = useMutation();
  const { rows } = useQuery(
    (db) =>
      db
        .selectFrom("todoCategory")
        .select(["id", "name"])
        .where("isDeleted", "is not", Evolu.cast(true))
        .orderBy("createdAt"),
    // (row) => row
    ({ name, ...rest }) => name && { name, ...rest },
  );

  const [text, setText] = useState("");
  const newTodoTitle = Schema.parseEither(NonEmptyString50)(text);
  const handleTextInputEndEditing = (): void => {
    newTodoTitle.pipe(
      Either.match({
        onLeft: constVoid,
        onRight: (name) => {
          create("todoCategory", { name });
          setText("");
        },
      }),
    );
  };

  return (
    <>
      <Text style={appStyles.h2}>Categories</Text>
      {rows.map(({ id, name }) => (
        <View key={id} style={{ marginBottom: 16 }}>
          <Text style={appStyles.item}>{name}</Text>
          <View style={{ flexDirection: "row" }}>
            <Button
              title="Delete"
              onPress={(): void => {
                update("todoCategory", { id, isDeleted: true });
              }}
            />
          </View>
        </View>
      ))}
      <TextInput
        autoComplete="off"
        autoCorrect={false}
        style={appStyles.textInput}
        value={text}
        onChangeText={setText}
        placeholder="New Category"
        onEndEditing={handleTextInputEndEditing}
      />
    </>
  );
};

const OwnerActions: FC = () => {
  const [isShown, setIsShown] = useState(false);
  const owner = useOwner();
  const ownerActions = useOwnerActions();

  return (
    <View>
      <Text>
        Open this page on a different device and use your mnemonic to restore
        your data.
      </Text>
      <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
        <Button
          title={`${!isShown ? "Show" : "Hide"} Mnemonic`}
          onPress={(): void => setIsShown((value) => !value)}
        />
        <Button
          title="Restore"
          onPress={(): void => {
            // prompt(Evolu.NonEmptyString1000, "Your Mnemonic", (mnemonic) => {
            //   void ownerActions.restore(mnemonic).then((either) => {
            //     if (either._tag === "Left")
            //       alert(JSON.stringify(either.left, null, 2));
            //   });
            // });
          }}
        />
        <Button
          title="Reset"
          onPress={(): void => {
            ownerActions.reset();
          }}
        />
      </View>
      {isShown && owner != null && (
        <TextInput multiline selectTextOnFocus>
          {owner.mnemonic}
        </TextInput>
      )}
    </View>
  );
};

const NotificationBar: FC = () => {
  const evoluError = useEvoluError();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (evoluError) setShown(true);
  }, [evoluError]);

  if (!evoluError || !shown) return <></>;

  return (
    <View>
      <Text>{`Error: ${JSON.stringify(evoluError)}`}</Text>
      <Button title="Close" onPress={(): void => setShown(false)} />
    </View>
  );
};

const NextJsExample: FC = () => {
  const [todosShown, setTodosShown] = useState(true);

  return (
    <Suspense>
      <NotificationBar />
      <View style={{ alignItems: "flex-start" }}>
        <Button
          title="Simulate suspense-enabled router"
          onPress={(): void => {
            // https://react.dev/reference/react/useTransition#building-a-suspense-enabled-router
            startTransition(() => {
              setTodosShown(!todosShown);
            });
          }}
        />
        <Text>
          Using suspense-enabled router transition, you will not see any loader
          or jumping content.
        </Text>
      </View>
      {todosShown ? <Todos /> : <TodoCategories />}
      <OwnerActions />
    </Suspense>
  );
};

export default function App(): JSX.Element {
  return (
    <ScrollView style={appStyles.container}>
      <Text style={appStyles.h1}>React Native Example</Text>
      <NextJsExample />
    </ScrollView>
  );
}

const appStyles = StyleSheet.create({
  h1: {
    fontSize: 24,
    marginVertical: 16,
  },
  h2: {
    fontSize: 18,
    marginVertical: 16,
  },
  item: {
    flexGrow: 1,
    flexShrink: 1,
    fontSize: 16,
  },
  textInput: {
    fontSize: 18,
    marginBottom: 16,
  },
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#fff",
  },
});
