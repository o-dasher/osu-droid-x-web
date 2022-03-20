
import { GetStaticProps, InferGetStaticPropsType} from "next";
import { assertDefined } from "../shared/assertions";
import Database from "../shared/database/Database";
import { OsuDroidStats } from "../shared/database/entities";

type LeaderboardProps = {
  status: Partial<OsuDroidStats>[]
}

export const getStaticProps: GetStaticProps<LeaderboardProps> = async () => {
  await Database.getConnection();

  const status: Partial<OsuDroidStats>[] = await OsuDroidStats.find({
    relations: ["user"],
    select: [
      "id",
      "pp",
      "rankedScore",
      "totalScore",
      "accuracy",
    ],
    order: {
      pp: "DESC"
    }
  });

  status.forEach(s => {
    const {user} = s;

    assertDefined(user);

    delete user.deviceIDS;
    delete user.sessionID;
    delete user.playing;
    delete user.privatePassword;
    delete user.email;
    delete user.privateMD5Email;
    delete user.scores;
    delete user.statisticsArray
    delete s.playcount;
    delete s.userId;
    delete s.rank;
  })

  return {
    props: {
      status: JSON.parse(JSON.stringify(status)),
    },
    revalidate: 60
  }
}

const LeaderboardPage = ({status}: InferGetStaticPropsType<typeof getStaticProps>) => {
  return (
    <div>
      <ol>
        {

          status.map(s => {
            const tS = s as OsuDroidStats;
            const {user} = tS;
            assertDefined(user)
            return (
              <li key={s.id}>
                {user.username} {" -> "} {tS.pp.toFixed(2)} {" -- acc: "} {tS.accuracy.toFixed(2)}
              </li>
            )
          })
        }
      </ol>
    </div>
  )
}

export default LeaderboardPage;