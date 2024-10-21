import { NextApiRequest, NextApiResponse } from 'next';
import { terminateEC2Instance } from '../../utils/services/ec2';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { resourceType, resourceId } = req.body as { resourceType: string; resourceId: string };
    
    if (!resourceType || !resourceId) {
      return res.status(400).json({ error: '리소스 유형과 ID가 필요합니다' });
    }

    try {
      if (resourceType === 'ec2') {
        const response = await terminateEC2Instance(resourceId);
        if (response.success) {
          res.status(200).json(response);
        } else {
          res.status(500).json(response);
        }
      } else {
        throw new Error('지원되지 않는 리소스 유형입니다');
      }
    } catch (error) {
      console.error('리소스 삭제 오류:', error);
      res.status(500).json({ 
        success: false, 
        message: '리소스 삭제 실패', 
        error: error instanceof Error ? error.message : '알 수 없는 오류' 
      });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
