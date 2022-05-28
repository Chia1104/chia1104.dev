import { GITHUB_API } from '@/utils/constants';
import { Chia } from '@/utils/meta/chia'

export const getAllRepos = async (user: string, page?: number, per_page?: number, sort?: string): Promise<{data: object, status: number}> => {
    const name = Chia.name.toLowerCase();
    const TOKEN = process.env.NEXT_PUBLIC_GH_PUBLIC_TOKEN;

    if (!user) user = name;
    if (!page) page = 1;
    if (!per_page) per_page = 10;
    if (!sort) sort = 'updated';

    try {
        const res = await fetch(`${GITHUB_API}users/${user}/repos?page=${page}&per_page=${per_page}&sort=${sort}`, {
            method: 'GET',
            headers: {
                Accept: 'application/vnd.github.v3+json',
                Authorization: `Bearer ${TOKEN}`,
            },
        });
        const data: object = await res.json();

        return { status: res.status, data: data }
    } catch (err: any) {
        throw err;
    }
}
